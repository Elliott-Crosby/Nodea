import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Admin user management: the contact list (GET) and the control surface
// (POST: promote/demote plan, set per-user token caps). All writes are
// service-role; the columns involved are excluded from client grants.

interface AuthUser {
  id: string
  email?: string
  created_at: string
  last_sign_in_at?: string | null
  user_metadata?: Record<string, unknown>
}

async function listAllAuthUsers(): Promise<AuthUser[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  const users: AuthUser[] = []
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (!r.ok) break
    const j = (await r.json()) as { users?: AuthUser[] }
    const batch = j.users ?? []
    users.push(...batch)
    if (batch.length < 100) break
  }
  return users
}

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!(await isAdmin(user.id, supabase))) {
    return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  const service = createServiceSupabaseClient()
  if (!service) return { error: Response.json({ error: 'Service client unavailable' }, { status: 500 }) }
  return { service, adminId: user.id }
}

export async function GET() {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx.error
  const { service } = ctx

  const [authUsers, profilesRes, usageRes] = await Promise.all([
    listAllAuthUsers(),
    service.from('user_profiles').select('user_id, plan, is_admin, early_bird, stripe_customer_id, marketing_opt_in, terms_accepted_at, custom_daily_tokens, custom_monthly_tokens, use_cases, use_cases_other, memory_imported_at'),
    service.from('user_token_usage').select('user_id, daily_tokens, monthly_tokens, total_tokens'),
  ])

  const profiles = new Map((profilesRes.data ?? []).map(p => [p.user_id as string, p]))
  const usage    = new Map((usageRes.data ?? []).map(u => [u.user_id as string, u]))

  const rows = authUsers
    .map(u => {
      const p = profiles.get(u.id)
      const t = usage.get(u.id)
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        plan: (p?.plan as string) ?? 'free',
        is_admin: !!p?.is_admin,
        early_bird: !!p?.early_bird,
        has_stripe: !!p?.stripe_customer_id,
        marketing_opt_in: !!p?.marketing_opt_in,
        terms_accepted: !!p?.terms_accepted_at,
        custom_daily_tokens: (p?.custom_daily_tokens as number | null) ?? null,
        custom_monthly_tokens: (p?.custom_monthly_tokens as number | null) ?? null,
        use_cases: (p?.use_cases as string[] | null) ?? null,
        use_cases_other: (p?.use_cases_other as string | null) ?? null,
        memory_imported: !!p?.memory_imported_at,
        total_tokens: (t?.total_tokens as number) ?? 0,
        monthly_tokens: (t?.monthly_tokens as number) ?? 0,
      }
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return Response.json({ users: rows })
}

interface PostBody {
  action: 'set_plan' | 'set_caps'
  userId: string
  plan?: 'free' | 'pro'
  daily?: number | null
  monthly?: number | null
}

export async function POST(req: Request) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx.error
  const { service } = ctx

  let body: PostBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.userId || typeof body.userId !== 'string') {
    return Response.json({ error: 'userId required' }, { status: 400 })
  }

  const { data: profile } = await service
    .from('user_profiles')
    .select('plan, stripe_customer_id')
    .eq('user_id', body.userId)
    .maybeSingle()

  if (body.action === 'set_plan') {
    if (body.plan !== 'free' && body.plan !== 'pro') {
      return Response.json({ error: 'plan must be free|pro' }, { status: 400 })
    }
    // Guard: paying customers are managed through Stripe, not manual demotion —
    // demoting here while their subscription is live would take away something
    // they're paying for; the webhook flips them to free at period end anyway.
    if (body.plan === 'free' && profile?.stripe_customer_id) {
      return Response.json(
        { error: 'stripe_managed', message: 'This user has a Stripe customer record — cancel their subscription in Stripe instead of demoting here.' },
        { status: 409 },
      )
    }
    const { error } = await service
      .from('user_profiles')
      .upsert({ user_id: body.userId, plan: body.plan }, { onConflict: 'user_id' })
    if (error) return Response.json({ error: 'Database error' }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (body.action === 'set_caps') {
    const valid = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v > 0)
    if (!valid(body.daily) || !valid(body.monthly)) {
      return Response.json({ error: 'caps must be positive integers or null' }, { status: 400 })
    }
    const { error } = await service
      .from('user_profiles')
      .upsert(
        { user_id: body.userId, custom_daily_tokens: body.daily ?? null, custom_monthly_tokens: body.monthly ?? null },
        { onConflict: 'user_id' },
      )
    if (error) return Response.json({ error: 'Database error' }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
