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

  return new Response('ok', { status: 200 })
}
