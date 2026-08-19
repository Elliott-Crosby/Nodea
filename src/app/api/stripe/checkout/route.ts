import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEarlyBirdStatus } from '@/lib/earlyBirdServer'
import { LAST_CHANCE_PRICE_ID } from '@/lib/lastChanceServer'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id, plan, early_bird, locked_price_id')
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

  // Price resolution, most protective first:
  //  1. locked_price_id — the durable per-user rate lock ($8 founding cohort,
  //     backfilled; $12 last-chance buyers, written by the webhook). Checked
  //     before every offer window so the lock outlives the offer, including
  //     after an involuntary churn (expired card) drops the plan to 'free'.
  //  2. early_bird — legacy boolean form of the same $8 lock; belt-and-braces
  //     for any row the locked_price_id backfill missed.
  //  3. Whatever offer is live right now (getEarlyBirdStatus reports the
  //     last-chance campaign once the founding offer expired).
  //  4. Standard. STRIPE_PRICE_ID_STANDARD must be set for offers to actually
  //     end — without it we warn and keep honoring the discounted price
  //     rather than break checkout.
  const status = await getEarlyBirdStatus()
  const standardPriceId = process.env.STRIPE_PRICE_ID_STANDARD
  let priceId: string
  if (profile?.locked_price_id) {
    priceId = profile.locked_price_id
  } else if (profile?.early_bird === true) {
    priceId = process.env.STRIPE_PRICE_ID!
  } else if (status.active) {
    priceId = status.offer === 'last_chance' ? LAST_CHANCE_PRICE_ID : process.env.STRIPE_PRICE_ID!
  } else if (standardPriceId) {
    priceId = standardPriceId
  } else {
    console.warn('offers ended but STRIPE_PRICE_ID_STANDARD is not set; still charging the discounted price')
    priceId = LAST_CHANCE_PRICE_ID
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/app?upgraded=true`,
    cancel_url: `${origin}/app`,
    // The lock rides along so the webhook can persist it without having to
    // re-fetch and price-match the session's line items. Any non-standard
    // price is a rate the buyer keeps forever; earlyBird stays for the legacy
    // boolean latch.
    metadata: {
      userId: user.id,
      earlyBird: String(priceId === process.env.STRIPE_PRICE_ID),
      lockPriceId: priceId !== standardPriceId ? priceId : '',
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
