import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'var(--ai-card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '18px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
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

  const [
    { count: totalUsers },
    { count: usersToday },
    { count: usersThisWeek },
    { data: tokenRows },
    { count: totalProjects },
  ] = await Promise.all([
    service.from('user_profiles').select('*', { count: 'exact', head: true }),
    service.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    service.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
    service.from('user_token_usage').select('user_id, daily_tokens, monthly_tokens, total_tokens'),
    service.from('projects').select('*', { count: 'exact', head: true }),
  ])

  const totalTokensAllTime = (tokenRows ?? []).reduce((sum, r) => sum + (r.total_tokens ?? 0), 0)
  const totalTokensToday   = (tokenRows ?? []).reduce((sum, r) => sum + (r.daily_tokens ?? 0), 0)
  const totalTokensMonth   = (tokenRows ?? []).reduce((sum, r) => sum + (r.monthly_tokens ?? 0), 0)

  const topUsers = [...(tokenRows ?? [])]
    .sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0))
    .slice(0, 10)

  const { data: authUsers } = await service.auth.admin.listUsers()
  const emailMap = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? u.id]))

  const topUsersWithEmail = topUsers.map((r) => ({
    user_id:        r.user_id,
    email:          emailMap.get(r.user_id) ?? r.user_id,
    total_tokens:   r.total_tokens ?? 0,
    daily_tokens:   r.daily_tokens ?? 0,
    monthly_tokens: r.monthly_tokens ?? 0,
  }))

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      padding: '32px 40px',
      fontFamily: 'inherit',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Analytics</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Admin view</div>
        </div>
        <a
          href="/app"
          style={{
            fontSize: 13, color: 'var(--text-secondary)',
            background: 'var(--bg-subtle)', border: '1px solid var(--border)',
            borderRadius: 7, padding: '6px 14px', cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          Back to app
        </a>
      </div>

      {/* Users */}
      <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Users</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard label="Total" value={totalUsers ?? 0} />
        <StatCard label="New today" value={usersToday ?? 0} />
        <StatCard label="New this week" value={usersThisWeek ?? 0} />
        <StatCard label="Total projects" value={totalProjects ?? 0} />
      </div>

      {/* Tokens */}
      <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Token usage</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard label="All time" value={fmt(totalTokensAllTime)} />
        <StatCard label="This month" value={fmt(totalTokensMonth)} />
        <StatCard label="Today" value={fmt(totalTokensToday)} />
      </div>

      {/* Top users table */}
      <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top users by token usage</div>
      <div style={{
        background: 'var(--ai-card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['User', 'All time', 'This month', 'Today'].map((h) => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topUsersWithEmail.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '20px 16px', color: 'var(--text-muted)', textAlign: 'center', fontSize: 13 }}>
                  No usage data yet.
                </td>
              </tr>
            )}
            {topUsersWithEmail.map((u, i) => (
              <tr
                key={u.user_id}
                style={{
                  borderBottom: i < topUsersWithEmail.length - 1 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent',
                }}
              >
                <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.email}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(u.total_tokens)}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(u.monthly_tokens)}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(u.daily_tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
