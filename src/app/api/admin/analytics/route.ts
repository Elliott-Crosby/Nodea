import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { resolveTz, todayStartUtc, windowStartUtc } from '@/lib/analytics-time'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = await isAdmin(user.id, supabase)
  if (!admin) return new Response('Forbidden', { status: 403 })

  const service = createServiceSupabaseClient()
  if (!service) return new Response('Service client unavailable', { status: 500 })

  const tz = resolveTz(new URL(req.url).searchParams.get('tz'))
  const todayStart = todayStartUtc(tz)
  const weekStart = windowStartUtc(7, tz)

  // PostgREST caps unbounded selects (default max-rows 1000), which would
  // silently truncate the token sums and top-10 — page through all rows.
  async function allTokenRows() {
    const PAGE = 1000
    const rows: { user_id: string; daily_tokens: number | null; monthly_tokens: number | null; total_tokens: number | null }[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await service!
        .from('user_token_usage')
        .select('user_id, daily_tokens, monthly_tokens, total_tokens')
        .order('user_id')
        .range(from, from + PAGE - 1)
      if (error || !data?.length) break
      rows.push(...data)
      if (data.length < PAGE) break
    }
    return rows
  }

  const [
    { count: totalUsers },
    { count: usersToday },
    { count: usersThisWeek },
    tokenRows,
    { count: totalProjects },
  ] = await Promise.all([
    service.from('user_profiles').select('*', { count: 'exact', head: true }),
    service
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    service
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString()),
    allTokenRows(),
    service.from('projects').select('*', { count: 'exact', head: true }),
  ])

  const totalTokensAllTime = (tokenRows ?? []).reduce((sum, r) => sum + (r.total_tokens ?? 0), 0)
  const totalTokensToday   = (tokenRows ?? []).reduce((sum, r) => sum + (r.daily_tokens ?? 0), 0)
  const totalTokensMonth   = (tokenRows ?? []).reduce((sum, r) => sum + (r.monthly_tokens ?? 0), 0)

  const topUsers = [...(tokenRows ?? [])]
    .sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0))
    .slice(0, 10)

  // Fetch emails for top users by id — listUsers() only returns the first
  // page (50), so past 50 signups top users would fall back to raw UUIDs.
  const topUserAuth = await Promise.all(
    topUsers.map((r) => service.auth.admin.getUserById(r.user_id)),
  )
  const emailMap = new Map(
    topUserAuth.flatMap(({ data }) => (data?.user ? [[data.user.id, data.user.email ?? data.user.id] as const] : [])),
  )

  const topUsersWithEmail = topUsers.map((r) => ({
    user_id:       r.user_id,
    email:         emailMap.get(r.user_id) ?? r.user_id,
    total_tokens:  r.total_tokens ?? 0,
    daily_tokens:  r.daily_tokens ?? 0,
    monthly_tokens: r.monthly_tokens ?? 0,
  }))

  return Response.json({
    users: {
      total:      totalUsers ?? 0,
      today:      usersToday ?? 0,
      this_week:  usersThisWeek ?? 0,
    },
    tokens: {
      all_time: totalTokensAllTime,
      today:    totalTokensToday,
      month:    totalTokensMonth,
    },
    projects: {
      total: totalProjects ?? 0,
    },
    top_users: topUsersWithEmail,
  })
}
