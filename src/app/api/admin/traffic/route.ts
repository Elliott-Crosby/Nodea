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

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await isAdmin(user.id, supabase)
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceSupabaseClient()
  if (!service) return Response.json({ error: 'Service client unavailable' }, { status: 500 })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29)
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0)

  const { data: rows, error } = await service
    .from('page_views')
    .select('path, session_id, created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (error) {
    // Table doesn't exist yet — migration needs to run
    if (error.message.includes('page_views') || error.code === '42P01') {
      return Response.json({ error: 'MIGRATION_PENDING' }, { status: 400 })
    }
    return Response.json({ error: `Database error: ${error.message}` }, { status: 500 })
  }

  // Page views by day
  const pvMap = buildDayMap(30)
  // Unique visitors by day: distinct session_ids per day
  const visitorMap = new Map<string, Set<string>>()
  pvMap.forEach((_, day) => visitorMap.set(day, new Set()))

  // Top pages
  const pathCounts = new Map<string, number>()

  for (const row of rows ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    if (pvMap.has(day)) {
      pvMap.set(day, pvMap.get(day)! + 1)
      if (row.session_id) visitorMap.get(day)!.add(row.session_id)
    }
    const p = row.path as string
    pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1)
  }

  const pageviews = Array.from(pvMap, ([day, count]) => ({ day, count }))
  const visitors  = Array.from(visitorMap, ([day, set]) => ({ day, count: set.size }))

  const totalPageviews = pageviews.reduce((s, d) => s + d.count, 0)
  const totalVisitors  = new Set((rows ?? []).map(r => r.session_id).filter(Boolean)).size

  const topPages = Array.from(pathCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, views]) => ({ path, views }))

  return Response.json({ pageviews, visitors, totalPageviews, totalVisitors, topPages })
}
