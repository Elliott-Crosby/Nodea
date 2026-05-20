import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
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

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
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
