import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_or8odXhUNMHxNIhnPw2e2scmoOug'
const VERCEL_TEAM_ID    = process.env.VERCEL_ORG_ID    ?? 'team_kosoS0n8Hy0CMoDPvCOzBcet'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await isAdmin(user.id, supabase)
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const token = process.env.VERCEL_ACCESS_TOKEN
  if (!token) {
    return Response.json({ error: 'VERCEL_ACCESS_TOKEN is not set.' }, { status: 400 })
  }

  const now = new Date()
  const from = new Date(now)
  from.setUTCDate(from.getUTCDate() - 29)
  from.setUTCHours(0, 0, 0, 0)

  const fromStr = from.toISOString().slice(0, 10)
  const toStr   = now.toISOString().slice(0, 10)

  const base = `https://api.vercel.com/v1/web/analytics`
  const qs = `projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&from=${fromStr}&to=${toStr}`
  const headers: HeadersInit = { Authorization: `Bearer ${token}` }

  // Build the 30-day skeleton so we always return a full array
  const dayMap = new Map<string, { pv: number; v: number }>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    dayMap.set(d.toISOString().slice(0, 10), { pv: 0, v: 0 })
  }

  try {
    const [summaryRes, timelineRes, pathsRes] = await Promise.all([
      fetch(`${base}?${qs}`, { headers }),
      fetch(`${base}/views?${qs}&granularity=day`, { headers }),
      fetch(`${base}/paths?${qs}&limit=8`, { headers }),
    ])

    if (!summaryRes.ok) {
      const body = await summaryRes.text().catch(() => summaryRes.statusText)
      return Response.json(
        { error: `Vercel API returned ${summaryRes.status}: ${body}` },
        { status: 502 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary: any  = await summaryRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeline: any = timelineRes.ok ? await timelineRes.json() : {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paths: any    = pathsRes.ok   ? await pathsRes.json()    : {}

    // Merge timeline data into day map
    for (const entry of (timeline?.data ?? [])) {
      const ts  = entry.timestamp ?? entry.ts
      const day = ts ? new Date(ts).toISOString().slice(0, 10) : null
      if (day && dayMap.has(day)) {
        dayMap.set(day, {
          pv: entry.pageViews ?? entry.views  ?? entry.count ?? 0,
          v:  entry.visitors  ?? entry.unique ?? 0,
        })
      }
    }

    const pageviews = Array.from(dayMap, ([day, v]) => ({ day, count: v.pv }))
    const visitors  = Array.from(dayMap, ([day, v]) => ({ day, count: v.v  }))

    const totalPageviews = summary?.pageViews ?? summary?.totalPageViews ??
      pageviews.reduce((s, d) => s + d.count, 0)
    const totalVisitors  = summary?.visitors  ?? summary?.uniqueVisitors  ??
      visitors.reduce((s, d) => s + d.count, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topPages = (paths?.data ?? []).map((p: any) => ({
      path:  p.path  ?? p.url ?? '/',
      views: p.pageViews ?? p.views ?? p.count ?? 0,
    }))

    return Response.json({ pageviews, visitors, totalPageviews, totalVisitors, topPages })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to reach Vercel API.' },
      { status: 500 },
    )
  }
}
