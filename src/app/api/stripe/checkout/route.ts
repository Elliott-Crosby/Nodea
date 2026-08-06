import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEarlyBirdStatus } from '@/lib/earlyBirdServer'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id, plan, early_bird')
    .eq('user_id', user.id)
    .maybeSingle()

  // Fail loudly rather than falling through with profile === null. A swallowed
  // read error (e.g. the early_bird migration not yet applied) would bypass the
  // already_pro guard and detach the existing Stripe customer — i.e. sell a
  // second subscription to someone who already has one.
  if (profileErr) {
    console.error('[stripe/checkout] profile read failed:', profileErr.code, profileErr.message)
    return Response.json({ error: 'checkout_unavailable' }, { status: 503 })
  }

  if (profile?.plan === 'pro') {
    return Response.json({ error: 'already_pro' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? ''

  // Early-bird enforcement: once the founding-seat cap is hit or the deadline
  // passes, new checkouts use the standard price. STRIPE_PRICE_ID stays the
  // early-bird price; STRIPE_PRICE_ID_STANDARD must be set for the offer to
  // actually end — without it we warn and keep honoring early-bird rather
  // than break checkout.
  //
  // profile.early_bird is the durable rate lock: anyone who bought during the
  // offer keeps the early-bird price forever, including after an involuntary
  // churn (expired card / failed dunning) drops them back to 'free'. It is
  // deliberately checked BEFORE the offer window so the lock outlives the offer.
  const earlyBird = await getEarlyBirdStatus()
  const locked = profile?.early_bird === true
  let priceId = process.env.STRIPE_PRICE_ID!
  if (!locked && !earlyBird.active) {
    const standard = process.env.STRIPE_PRICE_ID_STANDARD
    if (standard) {
      priceId = standard
    } else {
      console.warn('early-bird offer ended but STRIPE_PRICE_ID_STANDARD is not set; still charging early-bird price')
    }
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/app?upgraded=true`,
    cancel_url: `${origin}/app`,
    // earlyBird rides along so the webhook can persist the lock without having
    // to re-fetch and price-match the session's line items.
    metadata: {
      userId: user.id,
      earlyBird: String(priceId === process.env.STRIPE_PRICE_ID),
    },
  }

  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id
  } else {
    sessionParams.customer_email = user.email
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    return Response.json({ url: session.url })
  } catch (err) {
    // A bad/missing price id, a stale customer id, or a Stripe outage would
    // otherwise throw and return an HTML 500 — which the client cannot parse,
    // leaving the upgrade button dead and silent. Always answer in JSON.
    console.error('[stripe/checkout] session create failed:', err)
    return Response.json({ error: 'checkout_unavailable' }, { status: 502 })
  }
}
