import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { ADMIN_TZ, bucketByDay, windowStartUtc } from '@/lib/analytics-time'
import {
  getAdminUserIds,
  listAllAuthUsers,
  realSignups,
  notInList,
  fetchCreatedAtExcludingAdmins,
} from '@/lib/admin-stats'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await isAdmin(user.id, supabase)
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceSupabaseClient()
  if (!service) return Response.json({ error: 'Service client unavailable' }, { status: 500 })

  const url  = new URL(req.url)
  const days = Math.min(90, Math.max(7, parseInt(url.searchParams.get('days') ?? '30', 10)))

  // The admin dashboard is always reported in Eastern time, regardless of the
  // viewer's browser timezone.
  const since     = windowStartUtc(days, ADMIN_TZ)
  const adminIds  = await getAdminUserIds(service)
  const adminList = notInList(adminIds)

  const [authUsers, conversationCreatedAt, projectCreatedAt] = await Promise.all([
    listAllAuthUsers(service),
    fetchCreatedAtExcludingAdmins(service, 'projects', since.toISOString(), adminList),
    fetchCreatedAtExcludingAdmins(service, 'chat_projects', since.toISOString(), adminList),
  ])

  const signups = realSignups(authUsers, adminIds).map(u => u.created_at)

  return Response.json({
    usersByDay:         bucketByDay(signups, days, ADMIN_TZ),
    conversationsByDay: bucketByDay(conversationCreatedAt, days, ADMIN_TZ),
    projectsByDay:      bucketByDay(projectCreatedAt, days, ADMIN_TZ),
  })
}
