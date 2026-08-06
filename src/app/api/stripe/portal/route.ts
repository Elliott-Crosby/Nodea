import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.stripe_customer_id) {
    return Response.json({ error: 'no_subscription' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? ''
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/app`,
    })
    return Response.json({ url: portalSession.url })
  } catch (err) {
    // Stripe throws on a stale/foreign customer id or a missing portal
    // configuration. Answer in JSON either way so the client can say something
    // useful instead of failing to parse an HTML 500 page.
    console.error('[stripe/portal] session create failed:', err)
    return Response.json({ error: 'portal_unavailable' }, { status: 502 })
  }
}
