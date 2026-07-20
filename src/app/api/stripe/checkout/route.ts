import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEarlyBirdStatus } from '@/lib/earlyBirdServer'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id, plan')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.plan === 'pro') {
    return Response.json({ error: 'already_pro' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? ''

  // Early-bird enforcement: once the founding-seat cap is hit or the deadline
  // passes, new checkouts use the standard price. STRIPE_PRICE_ID stays the
  // early-bird price; STRIPE_PRICE_ID_STANDARD must be set for the offer to
  // actually end — without it we warn and keep honoring early-bird rather
  // than break checkout.
  const earlyBird = await getEarlyBirdStatus()
  let priceId = process.env.STRIPE_PRICE_ID!
  if (!earlyBird.active) {
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
    metadata: { userId: user.id },
  }

  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id
  } else {
    sessionParams.customer_email = user.email
  }

  const session = await stripe.checkout.sessions.create(sessionParams)
  return Response.json({ url: session.url })
}
