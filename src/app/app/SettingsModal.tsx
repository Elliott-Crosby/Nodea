'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/theme'
import { useApp } from './App'
import { createClient } from '@/lib/supabase'

type Section = 'appearance' | 'account' | 'usage'

export default function SettingsModal() {
  const { setIsSettingsOpen, userEmail, userName, setUserName, messages, convName, isPro } = useApp()
  const { theme, setTheme } = useTheme()
  const [section, setSection] = useState<Section>('appearance')

  // Account form state
  const [displayName, setDisplayName] = useState(userName)
  const [newEmail, setNewEmail] = useState(userEmail)
  const [newPw, setNewPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleExportMarkdown() {
    const lines: string[] = [`# ${convName || 'Conversation'}`, '']
    for (const msg of messages) {
      lines.push(`**${msg.role === 'user' ? 'You' : 'Claude'}:**`)
      lines.push(msg.content)
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(convName || 'conversation').replace(/[^a-z0-9]/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)
    const supabase = createClient()
    try {
      const updates: Record<string, unknown> = {}
      if (displayName !== userName) updates.data = { display_name: displayName }
      if (newEmail !== userEmail) updates.email = newEmail
      if (newPw) updates.password = newPw

      if (Object.keys(updates).length === 0) {
        setSaveMsg({ type: 'ok', text: 'Nothing to update.' })
        setSaving(false)
        return
      }

      const { error } = await supabase.auth.updateUser(updates)
      if (error) throw error

      setUserName(displayName)
      setSaveMsg({
        type: 'ok',
        text: newEmail !== userEmail
          ? 'Saved! Check your new email address to confirm the change.'
          : 'Saved successfully.',
      })
      setNewPw('')
    } catch (err: unknown) {
      setSaveMsg({ type: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
    {
      id: 'appearance',
      label: 'Appearance',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 2v5l3 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'account',
      label: 'Account',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1.5 12.5a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'usage',
      label: 'Usage',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="9" width="2.5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="5.75" y="5.5" width="2.5" height="7.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="10.5" y="1" width="2.5" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-overlay)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => setIsSettingsOpen(false)}
    >
      <div
        style={{
          width: 640,
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: '80vh',
          background: 'var(--modal-bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar nav */}
        <div
          style={{
            width: 185,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 0',
          }}
        >
          <div style={{ padding: '0 16px 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Settings
          </div>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 16px',
                background: section === item.id ? 'var(--accent-bg)' : 'transparent',
                border: 'none',
                borderLeft: section === item.id ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                cursor: 'pointer',
                color: section === item.id ? 'var(--accent-text)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: section === item.id ? 500 : 400,
                textAlign: 'left',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* Close button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              onClick={() => setIsSettingsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* ── Appearance ── */}
          {section === 'appearance' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Appearance</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Customize how Nodea looks.</p>

              <SettingRow label="Theme" description="Switch between light and dark mode">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 8,
                        border: `1.5px solid ${theme === t ? 'var(--accent)' : 'var(--border)'}`,
                        background: theme === t ? 'var(--accent-bg)' : 'var(--bg-subtle)',
                        color: theme === t ? 'var(--accent-text)' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: theme === t ? 600 : 400,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {t === 'light' ? '☀️ Light' : '🌙 Dark'}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <Divider />

              <SettingRow label="Export Conversation" description="Download the current conversation as a Markdown file">
                <button
                  onClick={handleExportMarkdown}
                  disabled={messages.length === 0}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-subtle)',
                    color: messages.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: 12,
                    cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: messages.length === 0 ? 0.5 : 1,
                  }}
                >
                  Export as Markdown
                </button>
              </SettingRow>
            </div>
          )}

          {/* ── Usage ── */}
          {section === 'usage' && <UsageTab isPro={isPro} />}

          {/* ── Account ── */}
          {section === 'account' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Account</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Manage your profile and credentials.</p>

              <form onSubmit={handleSaveAccount}>
                <SettingRow label="Display Name" description="Shown in the sidebar">
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={inputStyle}
                    placeholder="Your name"
                  />
                </SettingRow>

                <Divider />

                <SettingRow label="Email" description="Changing email requires confirmation">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    style={inputStyle}
                    placeholder="you@example.com"
                  />
                </SettingRow>

                <Divider />

                <SettingRow label="New Password" description="Leave blank to keep your current password">
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    style={inputStyle}
                    placeholder="New password (min 6 chars)"
                    minLength={6}
                  />
                </SettingRow>

                <Divider />

                {saveMsg && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: saveMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${saveMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                      color: saveMsg.type === 'ok' ? '#15803d' : '#b91c1c',
                      fontSize: 12,
                      marginBottom: 16,
                    }}
                  >
                    {saveMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Usage tab ────────────────────────────────────────────────────────────────

interface UsageRecord {
  daily_tokens: number
  monthly_tokens: number
  total_tokens?: number
  daily_reset_at: string
  monthly_reset_at: string
}

function UsageTab({ isPro }: { isPro: boolean }) {
  const [usage, setUsage]         = useState<UsageRecord | null>(null)
  const [loading, setLoading]     = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  const DAILY_LIMIT   = isPro ? 20_000  : 10_000
  const MONTHLY_LIMIT = isPro ? 250_000 : 125_000

  useEffect(() => {
    const supabase = createClient()

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('user_token_usage')
          .select('daily_tokens,monthly_tokens,total_tokens,daily_reset_at,monthly_reset_at')
          .maybeSingle()
        if (error) {
          console.warn('[UsageTab]', error.code, error.message, error.details)
        } else {
          setUsage(data as UsageRecord | null)
        }
      } finally {
        setLoading(false)
      }
    })()

    const channel = supabase
      .channel('usage-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_token_usage' },
        (payload) => { setUsage(payload.new as UsageRecord) },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_token_usage' },
        (payload) => { setUsage(payload.new as UsageRecord) },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  async function handleUpgrade() {
    setUpgrading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setUpgrading(false)
    }
  }

  async function handleManage() {
    setUpgrading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 40, textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  const now            = new Date()
  const dailyUsed      = !usage || now >= new Date(usage.daily_reset_at)   ? 0 : usage.daily_tokens
  const monthlyUsed    = !usage || now >= new Date(usage.monthly_reset_at) ? 0 : usage.monthly_tokens
  const totalUsed      = usage?.total_tokens ?? 0
  const dailyResetAt   = usage ? new Date(usage.daily_reset_at)   : null
  const monthlyResetAt = usage ? new Date(usage.monthly_reset_at) : null

  const dailyPct   = Math.min(100, (dailyUsed   / DAILY_LIMIT)   * 100)
  const monthlyPct = Math.min(100, (monthlyUsed / MONTHLY_LIMIT) * 100)

  function barColor(pct: number) {
    if (pct >= 90) return '#ef4444'
    if (pct >= 70) return '#f59e0b'
    return 'var(--accent)'
  }

  function fmtTime(d: Date) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
  }
  function fmtDate(d: Date) {
    return d.toLocaleDateString([], { month: 'long', day: 'numeric' })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Usage</h2>
        {isPro && (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a855f7', border: '1px solid #a855f7', borderRadius: 4, padding: '2px 7px' }}>
            PRO
          </span>
        )}
      </div>

      {isPro ? (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Pro plan</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Manage billing, cancel, or view invoices</div>
          </div>
          <button
            onClick={handleManage}
            disabled={upgrading}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.6 : 1 }}
          >
            {upgrading ? 'Loading…' : 'Manage'}
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--accent-bg)', border: '1px solid var(--user-bubble-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Upgrade to Pro</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>20k daily tokens, 250k monthly — double the free limits</div>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.6 : 1 }}
          >
            {upgrading ? 'Loading…' : 'Upgrade'}
          </button>
        </div>
      )}

      <UsageBar
        label="Daily"
        used={dailyUsed}
        limit={DAILY_LIMIT}
        pct={dailyPct}
        color={barColor(dailyPct)}
        resetLabel={dailyResetAt ? `Resets at ${fmtTime(dailyResetAt)}` : ''}
      />

      <div style={{ marginBottom: 20 }} />

      <UsageBar
        label="Monthly"
        used={monthlyUsed}
        limit={MONTHLY_LIMIT}
        pct={monthlyPct}
        color={barColor(monthlyPct)}
        resetLabel={monthlyResetAt ? `Resets on ${fmtDate(monthlyResetAt)}` : ''}
      />

      <div style={{ marginTop: 20, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>All-time tokens used</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{totalUsed.toLocaleString()}</span>
      </div>
    </div>
  )
}

function UsageBar({
  label, used, limit, pct, color, resetLabel,
}: {
  label: string; used: number; limit: number; pct: number; color: string; resetLabel: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {used.toLocaleString()} / {limit.toLocaleString()} tokens
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 99,
            background: color,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: pct >= 90 ? '#ef4444' : 'var(--text-muted)' }}>
          {pct.toFixed(0)}% used
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{resetLabel}</span>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 20 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{description}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 0 20px' }} />
}

const inputStyle: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  width: 220,
}
