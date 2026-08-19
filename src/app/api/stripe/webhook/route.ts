import Stripe from 'stripe'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { notifyAdmin } from '@/lib/email'

// Best-effort customer email lookup for notifications. Never throws — a
// notification must not fail the webhook.
async function customerEmail(stripe: Stripe, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string> {
  try {
    if (!customer) return '(unknown)'
    if (typeof customer !== 'string') {
      return ('email' in customer && customer.email) ? customer.email : '(unknown)'
    }
    const c = await stripe.customers.retrieve(customer)
    return ('email' in c && c.email) ? c.email : '(unknown)'
  } catch {
    return '(unknown)'
  }
}

function cancellationLines(details: Stripe.Subscription.CancellationDetails | null | undefined): string[] {
  if (!details) return []
  return [
    details.reason   ? `Reason: ${details.reason}` : null,
    details.feedback ? `Feedback: ${details.feedback}` : null,
    details.comment  ? `Comment: "${details.comment}"` : null,
  ].filter((l): l is string => !!l)
}

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
      // Rate locks are one-way latches: set them when the checkout used a
      // promotional price, but never write emptiness over an existing lock (a
      // returning locked user re-subscribing must not lose it). lockPriceId
      // carries the exact Stripe price the buyer keeps forever; early_bird
      // stays as the legacy boolean form of the founding $8 lock.
      const row: Record<string, unknown> = {
        user_id: userId,
        plan: 'pro',
        stripe_customer_id: customerId,
      }
      if (session.metadata?.earlyBird === 'true') row.early_bird = true
      if (session.metadata?.lockPriceId) row.locked_price_id = session.metadata.lockPriceId

      await db.from('user_profiles').upsert(row, { onConflict: 'user_id' })
    }

    const amount = `$${((session.amount_total ?? 0) / 100).toFixed(2)}/mo`
    await notifyAdmin('💰 New Nodea Pro subscription', [
      `Customer: ${session.customer_details?.email ?? '(unknown)'}`,
      `Amount: ${amount}`,
      session.metadata?.lockPriceId || session.metadata?.earlyBird === 'true'
        ? `Price: promotional (${amount} rate lock, ${session.metadata?.lockPriceId || 'legacy early-bird'})`
        : 'Price: standard',
      `Stripe customer: ${customerId ?? '(none)'}`,
    ])
  }

  // A cancellation scheduled from the billing portal fires subscription.updated
  // with cancel_at newly set — this is the "paid then quit 20 minutes later"
  // moment, and cancellation_details carries the user's stated reason. Without
  // this handler the founder only learns at period end, when deleted fires.
  if (event.type === 'customer.subscription.updated') {
    const sub  = event.data.object as Stripe.Subscription
    const prev = event.data.previous_attributes as Partial<Stripe.Subscription> | undefined
    const cancelJustScheduled =
      (sub.cancel_at || sub.cancel_at_period_end) &&
      prev && ('cancel_at' in prev || 'cancel_at_period_end' in prev) &&
      !prev.cancel_at && !prev.cancel_at_period_end

    if (cancelJustScheduled) {
      const email = await customerEmail(stripe, sub.customer)
      await notifyAdmin('⚠️ Pro subscription set to cancel', [
        `Customer: ${email}`,
        sub.cancel_at ? `Access ends: ${new Date(sub.cancel_at * 1000).toDateString()}` : null,
        ...cancellationLines(sub.cancellation_details),
        'They keep Pro until the period ends — a good moment for a personal note.',
      ])
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

    const email = await customerEmail(stripe, sub.customer)
    await notifyAdmin('📉 Pro subscription ended', [
      `Customer: ${email}`,
      ...cancellationLines(sub.cancellation_details),
      'Their plan is now free (early-bird rate lock preserved if they had it).',
    ])
  }

  return new Response('ok', { status: 200 })
}
