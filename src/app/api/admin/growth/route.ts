import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

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

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (days - 1))
  since.setUTCHours(0, 0, 0, 0)

  const [{ data: userRows }, { data: projectRows }] = await Promise.all([
    service.from('user_profiles').select('created_at').gte('created_at', since.toISOString()),
    service.from('projects').select('created_at').gte('created_at', since.toISOString()),
  ])

  const userDayMap = buildDayMap(days)
  for (const row of userRows ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    if (userDayMap.has(day)) userDayMap.set(day, userDayMap.get(day)! + 1)
  }

  const projDayMap = buildDayMap(days)
  for (const row of projectRows ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    if (projDayMap.has(day)) projDayMap.set(day, projDayMap.get(day)! + 1)
  }

  return Response.json({
    usersByDay:    Array.from(userDayMap,    ([day, count]) => ({ day, count })),
    projectsByDay: Array.from(projDayMap, ([day, count]) => ({ day, count })),
  })
}
