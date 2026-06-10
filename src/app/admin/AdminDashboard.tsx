'use client'

import { useEffect, useId, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface DayCount { day: string; count: number }

export interface DashboardData {
  totalUsers: number
  usersToday: number
  usersThisWeek: number
  totalConversations: number
  totalProjects: number
  totalTokensAllTime: number
  totalTokensToday: number
  totalTokensMonth: number
  usersByDay: DayCount[]
  conversationsByDay: DayCount[]
  projectsByDay: DayCount[]
  planBreakdown: { free: number; pro: number }
  topUsers: { email: string; total_tokens: number; daily_tokens: number; monthly_tokens: number }[]
}

interface DemoSummary {
  views: number
  visitors: number
  byDay: DayCount[]
  avgDurationMs: number | null
}

interface TrafficData {
  pageviews: DayCount[]
  visitors: DayCount[]
  totalPageviews: number
  totalVisitors: number
  topPages: { path: string; views: number; avg_duration_ms: number | null }[]
  bounceRate: number
  avgPagesPerSession: number
  avgSessionDurationMs: number | null
  recentEvents: { event_name: string; created_at: string; properties: Record<string, unknown> | null }[]
  eventBreakdown: { event_name: string; count: number }[]
  demo: DemoSummary
}

type Days = 7 | 30 | 90

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function fmtDay(day: string): string {
  const d = new Date(day + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function fmtDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return '—'
  if (ms < 1000)   return '<1s'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// Event timestamps are shown in Eastern time to match the rest of the dashboard.
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
  })
}

function trendDelta(arr: DayCount[]): number {
  const n = arr.length
  if (n < 2) return 0
  const half = Math.floor(n / 2)
  const prev = arr.slice(0, half).reduce((s, d) => s + d.count, 0)
  const curr = arr.slice(half).reduce((s, d) => s + d.count, 0)
  return prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100)
}

const EVENT_COLORS: Record<string, string> = {
  message_sent:         'var(--accent)',
  conversation_created: '#22c55e',
  branch_created:       '#f59e0b',
  settings_opened:      '#8b5cf6',
  search_opened:        '#06b6d4',
  upgrade_clicked:      '#ec4899',
  file_attached:        '#f97316',
}

function eventColor(name: string): string {
  return EVENT_COLORS[name] ?? 'var(--border-strong)'
}

// ── Primitives ─────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 10, fontSize: 11, fontWeight: 600,
      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {children}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'var(--ai-card-bg)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  )
}

// ── Sparkline chart ────────────────────────────────────────────────────────────
function SparkChart({ data, label, color = 'var(--accent)' }: { data: DayCount[]; label: string; color?: string }) {
  const uid    = useId().replace(/:/g, 'x')
  const H      = 64
  const W      = 500
  const padT   = 8
  const innerH = H - padT
  const n      = data.length
  const max    = Math.max(...data.map(d => d.count), 1)
  const total  = data.reduce((s, d) => s + d.count, 0)
  const pct    = trendDelta(data)
  const trendColor = pct > 0 ? '#22c55e' : pct < 0 ? 'var(--color-error)' : 'var(--text-muted)'
  const trendLabel = pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : '—'

  const xs   = data.map((_, i) => n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const ys   = data.map(d => padT + (1 - d.count / max) * innerH)
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${xs[n - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`
  const gridYs = [0.25, 0.5, 0.75].map(f => padT + (1 - f) * innerH)

  const [hovered, setHovered] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current || n === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHovered(Math.min(n - 1, Math.max(0, Math.round(relX * (n - 1)))))
  }

  const hoveredPoint = hovered !== null ? data[hovered] : null

  return (
    <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
            {hoveredPoint ? hoveredPoint.count.toLocaleString() : fmt(total)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, minHeight: 16 }}>
            {hoveredPoint ? fmtDay(hoveredPoint.day) : `total`}
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: trendColor, marginTop: 2 }}>{trendLabel}</div>
      </div>
      <div ref={containerRef} style={{ height: H, cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {gridYs.map((y, i) => (
            <line key={i} x1={0} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={0.8} />
          ))}
          <path d={area} fill={`url(#sg-${uid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          {hovered !== null ? (
            <>
              <line x1={xs[hovered]} y1={padT} x2={xs[hovered]} y2={H} stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              <circle cx={xs[hovered]} cy={ys[hovered]} r={4} fill={color} />
            </>
          ) : (
            n > 0 && <circle cx={xs[n - 1]} cy={ys[n - 1]} r={3} fill={color} />
          )}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDay(data[0]?.day ?? '')}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDay(data[n - 1]?.day ?? '')}</span>
      </div>
    </div>
  )
}

// ── Plan distribution ──────────────────────────────────────────────────────────
function PlanDistribution({ free, pro, total }: { free: number; pro: number; total: number }) {
  const segments = [
    { label: 'Free',  count: free,  color: 'var(--border-strong)' },
    { label: 'Pro',   count: pro,   color: 'var(--accent)' },
  ].filter(s => s.count > 0)

  return (
    <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        Plan distribution
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
        {segments.map(s => (
          <div key={s.label} style={{ flex: s.count, background: s.color, minWidth: 4, borderRadius: 4 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{s.count}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total ? Math.round((s.count / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Token bars ─────────────────────────────────────────────────────────────────
function TopUsersPanel({ users }: { users: DashboardData['topUsers'] }) {
  if (users.length === 0) return null
  const max = users[0]?.total_tokens ?? 1
  return (
    <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        Top users by token usage
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {users.map((u, i) => (
          <div key={u.email}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 16, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, flexShrink: 0, marginLeft: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>today </span>{fmt(u.daily_tokens)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(u.total_tokens)}</span>
              </div>
            </div>
            <div style={{ height: 4, background: 'var(--bg-muted)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(u.total_tokens / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Traffic sparkline ──────────────────────────────────────────────────────────
function TrafficSparkline({ data, label, color, total }: { data: DayCount[]; label: string; color: string; total: number }) {
  const uid    = useId().replace(/:/g, 'x')
  const H      = 56
  const W      = 500
  const padT   = 6
  const innerH = H - padT
  const n      = data.length
  const max    = Math.max(...data.map(d => d.count), 1)
  const pct    = trendDelta(data)
  const trendColor = pct > 0 ? '#22c55e' : pct < 0 ? 'var(--color-error)' : 'var(--text-muted)'
  const trendLabel = pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : '—'

  const xs   = data.map((_, i) => n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const ys   = data.map(d => padT + (1 - d.count / max) * innerH)
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${xs[n - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`

  const [hovered, setHovered] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current || n === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHovered(Math.min(n - 1, Math.max(0, Math.round(relX * (n - 1)))))
  }

  const hoveredPoint = hovered !== null ? data[hovered] : null

  return (
    <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
            {hoveredPoint ? hoveredPoint.count.toLocaleString() : fmt(total)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, minHeight: 16 }}>
            {hoveredPoint ? fmtDay(hoveredPoint.day) : 'total'}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: trendColor }}>{trendLabel}</span>
      </div>
      <div ref={containerRef} style={{ height: H, cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`ts-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#ts-${uid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          {hovered !== null ? (
            <>
              <line x1={xs[hovered]} y1={padT} x2={xs[hovered]} y2={H} stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              <circle cx={xs[hovered]} cy={ys[hovered]} r={4} fill={color} />
            </>
          ) : (
            n > 0 && <circle cx={xs[n - 1]} cy={ys[n - 1]} r={3} fill={color} />
          )}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDay(data[0]?.day ?? '')}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDay(data[n - 1]?.day ?? '')}</span>
      </div>
    </div>
  )
}

// ── Top pages list ─────────────────────────────────────────────────────────────
function TopPagesPanel({ pages }: { pages: TrafficData['topPages'] }) {
  if (pages.length === 0) return null
  const maxViews = pages[0]?.views ?? 1

  return (
    <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Top pages
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Views</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg time</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pages.map((p, i) => {
          const pct = (p.views / maxViews) * 100
          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {p.path}
                </span>
                <div style={{ display: 'flex', gap: 24, flexShrink: 0, marginLeft: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 36 }}>
                    {fmt(p.views)}
                  </span>
                  <span style={{ fontSize: 12, color: p.avg_duration_ms ? 'var(--text-secondary)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 48 }}>
                    {fmtDuration(p.avg_duration_ms)}
                  </span>
                </div>
              </div>
              <div style={{ height: 3, background: 'var(--bg-muted)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, opacity: 0.7 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Engagement stat row ────────────────────────────────────────────────────────
function EngagementStats({ bounceRate, avgPagesPerSession, avgSessionDurationMs }: {
  bounceRate: number
  avgPagesPerSession: number
  avgSessionDurationMs: number | null
}) {
  const bounceColor = bounceRate > 70 ? 'var(--color-error)' : bounceRate > 40 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {[
        {
          label: 'Bounce rate',
          value: `${bounceRate}%`,
          sub: 'single-page sessions',
          valueColor: bounceColor,
        },
        {
          label: 'Pages / session',
          value: avgPagesPerSession.toFixed(1),
          sub: 'avg pages per visit',
          valueColor: 'var(--text-primary)',
        },
        {
          label: 'Avg session time',
          value: fmtDuration(avgSessionDurationMs),
          sub: 'based on tracked pages',
          valueColor: 'var(--text-primary)',
        },
      ].map(stat => (
        <div key={stat.label} style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            {stat.label}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: stat.valueColor, lineHeight: 1.1 }}>{stat.value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{stat.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── Event breakdown ────────────────────────────────────────────────────────────
function EventBreakdown({ breakdown }: { breakdown: TrafficData['eventBreakdown'] }) {
  if (breakdown.length === 0) return null
  const max = breakdown[0]?.count ?? 1

  return (
    <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
        Events
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {breakdown.map(e => (
          <div key={e.event_name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: eventColor(e.event_name), flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.event_name}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(e.count)}
              </span>
            </div>
            <div style={{ height: 3, background: 'var(--bg-muted)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(e.count / max) * 100}%`, height: '100%', background: eventColor(e.event_name), borderRadius: 2, opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Recent event stream ────────────────────────────────────────────────────────
function EventStream({ events }: { events: TrafficData['recentEvents'] }) {
  if (events.length === 0) {
    return (
      <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Recent events
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No events recorded yet.</div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
        Recent events
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 320, overflowY: 'auto' }}>
        {events.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 0',
              borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                color: eventColor(e.event_name),
                border: `1px solid ${eventColor(e.event_name)}`,
                borderRadius: 4, padding: '2px 6px', flexShrink: 0,
                opacity: 0.9, whiteSpace: 'nowrap',
              }}
            >
              {e.event_name}
            </span>
            {e.properties && Object.keys(e.properties).length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {Object.entries(e.properties).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto', paddingLeft: 8 }}>
              {fmtTime(e.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Growth section (signups + conversations + projects, with range toggle) ─────
function GrowthSection({ initialUsersByDay, initialConversationsByDay, initialProjectsByDay }: {
  initialUsersByDay: DayCount[]
  initialConversationsByDay: DayCount[]
  initialProjectsByDay: DayCount[]
}) {
  const [days,               setDays]               = useState<Days>(30)
  const [usersByDay,         setUsersByDay]         = useState(initialUsersByDay)
  const [conversationsByDay, setConversationsByDay] = useState(initialConversationsByDay)
  const [projectsByDay,      setProjectsByDay]      = useState(initialProjectsByDay)
  const [loading,            setLoading]            = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/growth?days=${days}`)
      .then(r => r.json())
      .then(d => {
        setUsersByDay(d.usersByDay)
        setConversationsByDay(d.conversationsByDay)
        setProjectsByDay(d.projectsByDay)
      })
      .finally(() => setLoading(false))
  }, [days])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel>Growth</SectionLabel>
        <RangeToggle days={days} onChange={setDays} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12, opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <SparkChart data={usersByDay}         label={`User signups — ${days}d`} />
        <SparkChart data={conversationsByDay} label={`Conversations created — ${days}d`} color="#22c55e" />
        <SparkChart data={projectsByDay}      label={`Projects created — ${days}d`} color="#a78bfa" />
      </div>
    </>
  )
}

// ── Demo section (/demo page-view funnel) ──────────────────────────────────────
function DemoSection() {
  const [days,    setDays]    = useState<Days>(30)
  const [demo,    setDemo]    = useState<DemoSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/traffic?days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.demo) setDemo(d.demo) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const headerRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <SectionLabel>Demo · /demo</SectionLabel>
      <RangeToggle days={days} onChange={setDays} />
    </div>
  )

  if (loading && !demo) {
    return (
      <div style={{ marginBottom: 32 }}>
        {headerRow}
        <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '28px 22px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading demo…
        </div>
      </div>
    )
  }

  if (!demo) return null

  return (
    <div style={{ marginBottom: 32, opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
      {headerRow}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TrafficSparkline data={demo.byDay} label={`Demo visits — ${days}d`} color="#f59e0b" total={demo.views} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <StatCard label="Demo visits"       value={fmt(demo.views)} />
          <StatCard label="Unique visitors"   value={fmt(demo.visitors)} />
          <StatCard label="Avg time on /demo" value={fmtDuration(demo.avgDurationMs)} />
        </div>
        <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            The interactive demo runs client-side with no account or database, so these page-view
            metrics are the server-side signal. The in-demo funnel (messages sent, sign-up CTA
            clicks, conversions) is tracked in Vercel Analytics.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Time range toggle ──────────────────────────────────────────────────────────
function RangeToggle({ days, onChange }: { days: Days; onChange: (d: Days) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: 'var(--bg-muted)', borderRadius: 8, padding: 3 }}>
      {([7, 30, 90] as Days[]).map(d => (
        <button
          key={d}
          onClick={() => onChange(d)}
          style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: days === d ? 'var(--ai-card-bg)' : 'transparent',
            color: days === d ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: days === d ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {d}d
        </button>
      ))}
    </div>
  )
}

// ── Traffic section ────────────────────────────────────────────────────────────
function TrafficSection() {
  const [days,    setDays]    = useState<Days>(30)
  const [data,    setData]    = useState<TrafficData | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/traffic?days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Network error loading traffic data.'))
      .finally(() => setLoading(false))
  }, [days])

  const headerRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <SectionLabel>Traffic</SectionLabel>
      <RangeToggle days={days} onChange={setDays} />
    </div>
  )

  if (loading) {
    return (
      <>
        {headerRow}
        <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '28px 22px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading traffic…
        </div>
      </>
    )
  }

  if (error) {
    const needsMigration = error === 'MIGRATION_PENDING'
    const sql = `-- Run once in Supabase SQL Editor
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE TABLE IF NOT EXISTS public.events (
  id BIGSERIAL PRIMARY KEY, session_id TEXT,
  event_name TEXT NOT NULL, properties JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_insert_event" ON public.events FOR INSERT WITH CHECK (true);`

    return (
      <>
        {headerRow}
        <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '22px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {needsMigration ? 'Migration needed' : 'Traffic data unavailable'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 520, marginBottom: needsMigration ? 12 : 0 }}>
            {needsMigration ? 'Run this SQL in your Supabase SQL Editor, then reload:' : error}
          </div>
          {needsMigration && (
            <pre style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 7, padding: '12px 14px', overflowX: 'auto', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{sql}</pre>
          )}
        </div>
      </>
    )
  }

  if (!data) return null

  return (
    <>
      {headerRow}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {/* Pageviews + visitors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TrafficSparkline data={data.pageviews} label="Page views" color="var(--accent)" total={data.totalPageviews} />
          <TrafficSparkline data={data.visitors}  label="Unique visitors" color="#a78bfa" total={data.totalVisitors} />
        </div>

        {/* Engagement stats */}
        <EngagementStats
          bounceRate={data.bounceRate}
          avgPagesPerSession={data.avgPagesPerSession}
          avgSessionDurationMs={data.avgSessionDurationMs}
        />

        {/* Top pages */}
        <TopPagesPanel pages={data.topPages} />

        {/* Events row */}
        {(data.eventBreakdown.length > 0 || data.recentEvents.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12 }}>
            <EventBreakdown breakdown={data.eventBreakdown} />
            <EventStream events={data.recentEvents} />
          </div>
        )}
        {data.eventBreakdown.length === 0 && data.recentEvents.length === 0 && (
          <div style={{ background: 'var(--ai-card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 22px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              No events recorded yet — event tracking fires automatically as users interact with the app.
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export function AdminDashboard(props: DashboardData) {
  const {
    totalUsers, usersToday, usersThisWeek, totalConversations, totalProjects,
    totalTokensAllTime, totalTokensToday, totalTokensMonth,
    usersByDay, conversationsByDay, projectsByDay, planBreakdown, topUsers,
  } = props

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', padding: '32px 40px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Analytics</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Admin view · admins excluded · times in ET</div>
          </div>
          <a
            href="/app"
            style={{
              fontSize: 13, color: 'var(--text-secondary)',
              background: 'var(--bg-subtle)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '6px 14px', textDecoration: 'none',
            }}
          >
            Back to app
          </a>
        </div>

        {/* Users */}
        <SectionLabel>Users</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatCard label="Total signups" value={totalUsers} />
          <StatCard label="New today"     value={usersToday} />
          <StatCard label="New this week" value={usersThisWeek} />
        </div>

        {/* Content — conversations (legacy `projects` table) vs Projects (chat_projects) */}
        <SectionLabel>Content</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatCard label="Conversations" value={totalConversations} />
          <StatCard label="Projects"      value={totalProjects} />
        </div>

        <GrowthSection
          initialUsersByDay={usersByDay}
          initialConversationsByDay={conversationsByDay}
          initialProjectsByDay={projectsByDay}
        />

        <div style={{ marginBottom: 32 }}>
          <PlanDistribution {...planBreakdown} total={totalUsers} />
        </div>

        {/* Tokens */}
        <SectionLabel>Token usage</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 8 }}>
          <StatCard label="All time"   value={fmt(totalTokensAllTime)} />
          <StatCard label="This month" value={fmt(totalTokensMonth)} />
          <StatCard label="Today"      value={fmt(totalTokensToday)} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          Token windows reset at midnight UTC (daily) and the 1st UTC (monthly) — only live counters are summed.
        </div>
        <div style={{ marginBottom: 32 }}>
          <TopUsersPanel users={topUsers} />
        </div>

        {/* Demo */}
        <DemoSection />

        {/* Traffic */}
        <TrafficSection />

      </div>
    </div>
  )
}
