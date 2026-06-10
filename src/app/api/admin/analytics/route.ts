import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { ADMIN_TZ, todayStartUtc, windowStartUtc } from '@/lib/analytics-time'
import {
  getAdminUserIds,
  listAllAuthUsers,
  realSignups,
  getAllTokenRows,
  summarizeTokens,
  notInList,
  countExcludingAdmins,
} from '@/lib/admin-stats'

// JSON summary of the dashboard's headline numbers. Mirrors the server component
// in src/app/admin/page.tsx — admins excluded, signups from auth.users, EST.
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = await isAdmin(user.id, supabase)
  if (!admin) return new Response('Forbidden', { status: 403 })

  const service = createServiceSupabaseClient()
  if (!service) return new Response('Service client unavailable', { status: 500 })

  const now        = new Date()
  const todayStart = todayStartUtc(ADMIN_TZ)
  const weekStart  = windowStartUtc(7, ADMIN_TZ)

  const adminIds   = await getAdminUserIds(service)
  const adminList  = notInList(adminIds)

  const [authUsers, tokenRows, conversationsTotal, projectsTotal] = await Promise.all([
    listAllAuthUsers(service),
    getAllTokenRows(service),
    countExcludingAdmins(service, 'projects', adminList),
    countExcludingAdmins(service, 'chat_projects', adminList),
  ])

  const signups = realSignups(authUsers, adminIds)
  const tokens  = summarizeTokens(tokenRows, adminIds, now)

  const emailMap = new Map(authUsers.map(u => [u.id, u.email ?? u.id]))
  const topUsers = tokenRows
    .filter(r => !adminIds.has(r.user_id))
    .sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0))
    .slice(0, 10)
    .map(r => ({
      user_id:        r.user_id,
      email:          emailMap.get(r.user_id) ?? r.user_id,
      total_tokens:   r.total_tokens ?? 0,
      daily_tokens:   r.daily_reset_at && new Date(r.daily_reset_at) > now ? (r.daily_tokens ?? 0) : 0,
      monthly_tokens: r.monthly_reset_at && new Date(r.monthly_reset_at) > now ? (r.monthly_tokens ?? 0) : 0,
    }))

  return Response.json({
    timezone: ADMIN_TZ,
    users: {
      total:     signups.length,
      today:     signups.filter(u => new Date(u.created_at) >= todayStart).length,
      this_week: signups.filter(u => new Date(u.created_at) >= weekStart).length,
    },
    tokens: {
      all_time: tokens.all,
      today:    tokens.today,
      month:    tokens.month,
    },
    conversations: { total: conversationsTotal },
    projects:      { total: projectsTotal },
    top_users:     topUsers,
  })
}
