import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { ADMIN_TZ, bucketByDay, todayStartUtc, windowStartUtc } from '@/lib/analytics-time'
import {
  getAdminUserIds,
  listAllAuthUsers,
  realSignups,
  getAllTokenRows,
  summarizeTokens,
  notInList,
  fetchCreatedAtExcludingAdmins,
  countExcludingAdmins,
  type ProfileRow,
} from '@/lib/admin-stats'
import { AdminDashboard } from './AdminDashboard'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = await isAdmin(user.id, supabase)
  if (!admin) redirect('/app')

  const service = createServiceSupabaseClient()
  if (!service) return <div>Service client unavailable.</div>

  const now          = new Date()
  const todayStart   = todayStartUtc(ADMIN_TZ)
  const weekStart    = windowStartUtc(7, ADMIN_TZ)
  const thirtyStart  = windowStartUtc(30, ADMIN_TZ)

  // Admin ids first — every other query depends on excluding them.
  const adminIds   = await getAdminUserIds(service)
  const adminList  = notInList(adminIds)

  const [
    authUsers,
    tokenRows,
    { data: profileRows },
    conversationsTotal,
    projectsTotal,
    conversationCreatedAt,
    projectCreatedAt,
  ] = await Promise.all([
    listAllAuthUsers(service),
    getAllTokenRows(service),
    service.from('user_profiles').select('user_id, plan, is_admin, stripe_customer_id'),
    countExcludingAdmins(service, 'projects', adminList),
    countExcludingAdmins(service, 'chat_projects', adminList),
    fetchCreatedAtExcludingAdmins(service, 'projects', thirtyStart.toISOString(), adminList),
    fetchCreatedAtExcludingAdmins(service, 'chat_projects', thirtyStart.toISOString(), adminList),
  ])

  // ── Signups (from auth.users, excluding admins + anonymous) ──────────────────
  const signups        = realSignups(authUsers, adminIds)
  const totalUsers     = signups.length
  const usersToday     = signups.filter(u => new Date(u.created_at) >= todayStart).length
  const usersThisWeek  = signups.filter(u => new Date(u.created_at) >= weekStart).length
  const usersByDay     = bucketByDay(signups.map(u => u.created_at), 30, ADMIN_TZ)

  // ── Conversations + Projects by day (EST, admin-excluded) ────────────────────
  const conversationsByDay = bucketByDay(conversationCreatedAt, 30, ADMIN_TZ)
  const projectsByDay      = bucketByDay(projectCreatedAt, 30, ADMIN_TZ)

  // ── Plan breakdown (Free vs Pro among real signups; admins excluded) ─────────
  // Pro must carry a stripe_customer_id — a 'pro' row without one is self-granted
  // and unlocks nothing (see src/lib/plan.ts).
  const proUserIds = new Set(
    (profileRows as ProfileRow[] | null ?? [])
      .filter(p => p.plan === 'pro' && !!p.stripe_customer_id && !adminIds.has(p.user_id))
      .map(p => p.user_id),
  )
  const signupIds  = new Set(signups.map(u => u.id))
  const proCount   = [...proUserIds].filter(id => signupIds.has(id)).length
  const planBreakdown = { free: Math.max(0, totalUsers - proCount), pro: proCount }

  // ── Token totals + top users (admin-excluded, live windows only) ─────────────
  const tokens = summarizeTokens(tokenRows, adminIds, now)

  const emailMap = new Map(authUsers.map(u => [u.id, u.email ?? u.id]))
  const topUsers = tokenRows
    .filter(r => !adminIds.has(r.user_id))
    .sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0))
    .slice(0, 10)
    .map(r => ({
      email:          emailMap.get(r.user_id) ?? r.user_id,
      total_tokens:   r.total_tokens   ?? 0,
      daily_tokens:   r.daily_reset_at && new Date(r.daily_reset_at) > now ? (r.daily_tokens ?? 0) : 0,
      monthly_tokens: r.monthly_reset_at && new Date(r.monthly_reset_at) > now ? (r.monthly_tokens ?? 0) : 0,
    }))

  return (
    <AdminDashboard
      totalUsers={totalUsers}
      usersToday={usersToday}
      usersThisWeek={usersThisWeek}
      totalConversations={conversationsTotal}
      totalProjects={projectsTotal}
      totalTokensAllTime={tokens.all}
      totalTokensToday={tokens.today}
      totalTokensMonth={tokens.month}
      usersByDay={usersByDay}
      conversationsByDay={conversationsByDay}
      projectsByDay={projectsByDay}
      planBreakdown={planBreakdown}
      topUsers={topUsers}
    />
  )
}
