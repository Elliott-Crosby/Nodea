import Stripe from 'stripe'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  const db = createServiceSupabaseClient()
  if (!db) {
    console.error('[stripe/webhook] service role client unavailable')
    return new Response('DB unavailable', { status: 500 })
  }

  // Idempotency: Stripe can redeliver the same event. Record event.id first; a
  // duplicate-key error means we've already processed it → ack and stop before
  // any side effects. If the ledger table isn't present yet (migration not
  // pushed), degrade gracefully and continue — today's handlers are idempotent.
  const { error: dedupErr } = await db
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })
  if (dedupErr) {
    if (dedupErr.code === '23505') {
      return new Response('ok (duplicate)', { status: 200 })
    }
    if (dedupErr.code !== '42P01' && dedupErr.code !== 'PGRST205') {
      // Real, unexpected error (not "table missing") — log but still process.
      console.error('[stripe/webhook] dedup insert failed:', dedupErr.code, dedupErr.message)
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

    if (userId && customerId) {
      // early_bird is a one-way latch: set it when the checkout used the
      // early-bird price, but never write false over an existing true (a
      // returning early bird re-subscribing must not lose the lock).
      const row: Record<string, unknown> = {
        user_id: userId,
        plan: 'pro',
        stripe_customer_id: customerId,
      }
      if (session.metadata?.earlyBird === 'true') row.early_bird = true

      await db.from('user_profiles').upsert(row, { onConflict: 'user_id' })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

    // Only the plan is revoked. early_bird deliberately survives cancellation —
    // an expired card must not cost someone their locked-in rate.
    await db.from('user_profiles')
      .update({ plan: 'free' })
      .eq('stripe_customer_id', customerId)
  }

  return new Response('ok', { status: 200 })
}
