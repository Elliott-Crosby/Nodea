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
      await db.from('user_profiles').upsert(
        { user_id: userId, plan: 'pro', stripe_customer_id: customerId },
        { onConflict: 'user_id' },
      )
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

    await db.from('user_profiles')
      .update({ plan: 'free' })
      .eq('stripe_customer_id', customerId)
  }

  // Dunning / cancel-at-period-end / portal cancel all arrive as `updated`, not
  // `deleted`. Without this, a subscription that goes past_due/unpaid/canceled
  // keeps the user on Pro indefinitely (Opus, higher limits, projects, memory)
  // because nothing flips plan back to 'free' until an eventual `deleted` that
  // may never come. Only active/trialing stays entitled. A cancel-at-period-end
  // subscription stays 'active' until the period ends, so it correctly keeps Pro
  // until Stripe later fires `deleted`. Redelivery is safe (idempotent update).
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const entitled = sub.status === 'active' || sub.status === 'trialing'

    await db.from('user_profiles')
      .update({ plan: entitled ? 'pro' : 'free' })
      .eq('stripe_customer_id', customerId)
  }

  return new Response('ok', { status: 200 })
}
