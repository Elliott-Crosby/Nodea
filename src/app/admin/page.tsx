import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { AdminDashboard } from './AdminDashboard'

function buildDayMap(days: number): Map<string, number> {
  const map = new Map<string, number>()
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    map.set(d.toISOString().slice(0, 10), 0)
  }
  return map
}

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = await isAdmin(user.id, supabase)
  if (!admin) redirect('/app')

  const service = createServiceSupabaseClient()
  if (!service) return <div>Service client unavailable.</div>

  const now = new Date()

  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)

  const weekStart = new Date(now)
  weekStart.setUTCDate(weekStart.getUTCDate() - 6)
  weekStart.setUTCHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29)
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0)

  const [
    { count: totalUsers },
    { count: usersToday },
    { count: usersThisWeek },
    { data: tokenRows },
    { count: totalProjects },
    { data: userCreatedRows },
    { data: projectCreatedRows },
    { data: planRows },
  ] = await Promise.all([
    service.from('user_profiles').select('*', { count: 'exact', head: true }),
    service.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    service.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
    service.from('user_token_usage').select('user_id, daily_tokens, monthly_tokens, total_tokens'),
    service.from('projects').select('*', { count: 'exact', head: true }),
    service.from('user_profiles').select('created_at').gte('created_at', thirtyDaysAgo.toISOString()),
    service.from('projects').select('created_at').gte('created_at', thirtyDaysAgo.toISOString()),
    service.from('user_profiles').select('plan, is_admin'),
  ])

  // User registrations by day
  const userDayMap = buildDayMap(30)
  for (const row of userCreatedRows ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    if (userDayMap.has(day)) userDayMap.set(day, userDayMap.get(day)! + 1)
  }
  const usersByDay = Array.from(userDayMap, ([day, count]) => ({ day, count }))

  // Projects by day
  const projDayMap = buildDayMap(30)
  for (const row of projectCreatedRows ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    if (projDayMap.has(day)) projDayMap.set(day, projDayMap.get(day)! + 1)
  }
  const projectsByDay = Array.from(projDayMap, ([day, count]) => ({ day, count }))

  // Plan breakdown
  const planBreakdown = { free: 0, pro: 0, admin: 0 }
  for (const row of planRows ?? []) {
    if (row.is_admin) planBreakdown.admin++
    else if (row.plan === 'pro') planBreakdown.pro++
    else planBreakdown.free++
  }

  // Token totals
  const totalTokensAllTime = (tokenRows ?? []).reduce((s, r) => s + (r.total_tokens ?? 0), 0)
  const totalTokensToday   = (tokenRows ?? []).reduce((s, r) => s + (r.daily_tokens  ?? 0), 0)
  const totalTokensMonth   = (tokenRows ?? []).reduce((s, r) => s + (r.monthly_tokens ?? 0), 0)

  // Top users with emails
  const topUsers = [...(tokenRows ?? [])].sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0)).slice(0, 10)
  const { data: authUsers } = await service.auth.admin.listUsers()
  const emailMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.email ?? u.id]))
  const topUsersWithEmail = topUsers.map(r => ({
    email:          emailMap.get(r.user_id) ?? r.user_id,
    total_tokens:   r.total_tokens   ?? 0,
    daily_tokens:   r.daily_tokens   ?? 0,
    monthly_tokens: r.monthly_tokens ?? 0,
  }))

  return (
    <AdminDashboard
      totalUsers={totalUsers ?? 0}
      usersToday={usersToday ?? 0}
      usersThisWeek={usersThisWeek ?? 0}
      totalProjects={totalProjects ?? 0}
      totalTokensAllTime={totalTokensAllTime}
      totalTokensToday={totalTokensToday}
      totalTokensMonth={totalTokensMonth}
      usersByDay={usersByDay}
      projectsByDay={projectsByDay}
      planBreakdown={planBreakdown}
      topUsers={topUsersWithEmail}
    />
  )
}
