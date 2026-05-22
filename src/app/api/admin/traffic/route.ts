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

  // ── Page views ──────────────────────────────────────────────────────────────
  const { data: rows, error } = await service
    .from('page_views')
    .select('path, session_id, created_at, duration_ms')
    .gte('created_at', since.toISOString())

  if (error) {
    if (error.message.includes('page_views') || error.code === '42P01') {
      return Response.json({ error: 'MIGRATION_PENDING' }, { status: 400 })
    }
    return Response.json({ error: `Database error: ${error.message}` }, { status: 500 })
  }

  const pvMap      = buildDayMap(days)
  const visitorMap = new Map<string, Set<string>>()
  pvMap.forEach((_, day) => visitorMap.set(day, new Set()))

  const pathCounts:    Map<string, number>    = new Map()
  const pathDurations: Map<string, number[]>  = new Map()
  const sessionPages:  Map<string, number>    = new Map() // session_id → page count
  const sessionDurs:   Map<string, number>    = new Map() // session_id → total duration ms

  for (const row of rows ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    if (pvMap.has(day)) {
      pvMap.set(day, pvMap.get(day)! + 1)
      const sid = row.session_id as string | null
      if (sid) visitorMap.get(day)!.add(sid)
    }

    const p = row.path as string
    pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1)

    const sid = row.session_id as string | null
    if (sid) {
      sessionPages.set(sid, (sessionPages.get(sid) ?? 0) + 1)
    }

    const dur = row.duration_ms as number | null
    if (dur && dur > 0) {
      if (!pathDurations.has(p)) pathDurations.set(p, [])
      pathDurations.get(p)!.push(dur)
      if (sid) sessionDurs.set(sid, (sessionDurs.get(sid) ?? 0) + dur)
    }
  }

  const pageviews = Array.from(pvMap,      ([day, count]) => ({ day, count }))
  const visitors  = Array.from(visitorMap, ([day, set])   => ({ day, count: set.size }))

  const totalPageviews = pageviews.reduce((s, d) => s + d.count, 0)
  const totalVisitors  = new Set((rows ?? []).map(r => r.session_id).filter(Boolean)).size

  const topPages = Array.from(pathCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, views]) => {
      const durs = pathDurations.get(path) ?? []
      const avg_duration_ms = durs.length > 0
        ? Math.round(durs.reduce((s, d) => s + d, 0) / durs.length)
        : null
      return { path, views, avg_duration_ms }
    })

  // ── Session engagement ──────────────────────────────────────────────────────
  const totalSessions  = sessionPages.size
  const bounceSessions = Array.from(sessionPages.values()).filter(c => c === 1).length
  const bounceRate     = totalSessions > 0 ? Math.round((bounceSessions / totalSessions) * 100) : 0

  const totalPageCount = Array.from(sessionPages.values()).reduce((s, c) => s + c, 0)
  const avgPagesPerSession = totalSessions > 0
    ? Math.round((totalPageCount / totalSessions) * 10) / 10
    : 0

  const durValues = Array.from(sessionDurs.values()).filter(d => d > 0)
  const avgSessionDurationMs = durValues.length > 0
    ? Math.round(durValues.reduce((s, d) => s + d, 0) / durValues.length)
    : null

  // ── Events ─────────────────────────────────────────────────────────────────
  const { data: eventRows } = await service
    .from('events')
    .select('event_name, created_at, properties')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  const eventCounts = new Map<string, number>()
  for (const e of eventRows ?? []) {
    const n = e.event_name as string
    eventCounts.set(n, (eventCounts.get(n) ?? 0) + 1)
  }

  const recentEvents    = (eventRows ?? []).slice(0, 40)
  const eventBreakdown  = Array.from(eventCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([event_name, count]) => ({ event_name, count }))

  return Response.json({
    pageviews, visitors, totalPageviews, totalVisitors, topPages,
    bounceRate, avgPagesPerSession, avgSessionDurationMs,
    recentEvents, eventBreakdown,
  })
}
