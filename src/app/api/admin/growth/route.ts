import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { resolveTz, buildDayMap, windowStartUtc, dayInTz } from '@/lib/analytics-time'

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
  const tz   = resolveTz(url.searchParams.get('tz'))

  const since = windowStartUtc(days, tz)

  const [{ data: userRows }, { data: projectRows }] = await Promise.all([
    service.from('user_profiles').select('created_at').gte('created_at', since.toISOString()),
    service.from('projects').select('created_at').gte('created_at', since.toISOString()),
  ])

  const userDayMap = buildDayMap(days, tz)
  for (const row of userRows ?? []) {
    const day = dayInTz(new Date(row.created_at as string), tz)
    if (userDayMap.has(day)) userDayMap.set(day, userDayMap.get(day)! + 1)
  }

  const projDayMap = buildDayMap(days, tz)
  for (const row of projectRows ?? []) {
    const day = dayInTz(new Date(row.created_at as string), tz)
    if (projDayMap.has(day)) projDayMap.set(day, projDayMap.get(day)! + 1)
  }

  return Response.json({
    usersByDay:    Array.from(userDayMap,    ([day, count]) => ({ day, count })),
    projectsByDay: Array.from(projDayMap, ([day, count]) => ({ day, count })),
  })
}
