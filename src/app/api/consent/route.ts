import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { TERMS_VERSION } from '@/lib/consent'

// Consent records are written exclusively here (service role) so the
// timestamp comes from the server clock and the columns can stay excluded
// from the client's column grants. Signup stores the user's choices in auth
// metadata (available even before email confirmation); GET self-heals that
// metadata into a durable profile row the first time the app checks.

interface ProfileConsentRow {
  terms_accepted_at: string | null
  terms_version: string | null
  marketing_opt_in: boolean | null
}

function stateFrom(row: ProfileConsentRow | null) {
  return {
    termsAccepted: !!row?.terms_accepted_at,
    termsVersion: row?.terms_version ?? null,
    marketingOptIn: !!row?.marketing_opt_in,
    currentVersion: TERMS_VERSION,
  }
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabaseClient()
  if (!service) return Response.json({ error: 'Service client unavailable' }, { status: 500 })

  const { data: profile } = await service
    .from('user_profiles')
    .select('terms_accepted_at, terms_version, marketing_opt_in')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.terms_accepted_at) return Response.json(stateFrom(profile))

  // Self-heal: consent given at signup rides in auth metadata until the first
  // authed visit lands here and we persist it with the signup-time values.
  const meta = user.user_metadata ?? {}
  if (typeof meta.terms_accepted_at === 'string' && meta.terms_accepted_at) {
    const row = {
      user_id: user.id,
      terms_accepted_at: meta.terms_accepted_at,
      terms_version: typeof meta.terms_version === 'string' ? meta.terms_version : TERMS_VERSION,
      marketing_opt_in: meta.marketing_opt_in === true,
      ...(meta.marketing_opt_in === true ? { marketing_updated_at: meta.terms_accepted_at } : {}),
    }
    const { error } = await service
      .from('user_profiles')
      .upsert(row, { onConflict: 'user_id' })
    if (!error) {
      return Response.json(stateFrom(row as unknown as ProfileConsentRow))
    }
  }

  return Response.json(stateFrom(profile ?? null))
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabaseClient()
  if (!service) return Response.json({ error: 'Service client unavailable' }, { status: 500 })

  let body: { acceptTerms?: boolean; marketingOptIn?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const row: Record<string, unknown> = { user_id: user.id }

  if (body.acceptTerms === true) {
    row.terms_accepted_at = now
    row.terms_version = TERMS_VERSION
  }
  if (typeof body.marketingOptIn === 'boolean') {
    row.marketing_opt_in = body.marketingOptIn
    row.marketing_updated_at = now
  }

  if (Object.keys(row).length === 1) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await service
    .from('user_profiles')
    .upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[consent] upsert failed:', error.code, error.message)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }

  const { data: profile } = await service
    .from('user_profiles')
    .select('terms_accepted_at, terms_version, marketing_opt_in')
    .eq('user_id', user.id)
    .maybeSingle()

  return Response.json(stateFrom(profile ?? null))
}
