'use client'

import { useState, useEffect } from 'react'
import { track } from '@vercel/analytics'
import { useTheme } from '@/lib/theme'
import { useApp } from './App'
import { createClient } from '@/lib/supabase'

type Section = 'appearance' | 'account' | 'usage' | 'memory'

interface MemoryRow {
  id:         string
  content:    string
  source:     'auto' | 'manual'
  created_at: string
}

const MEMORY_MAX_LENGTH  = 300
const MEMORY_MAX_ENTRIES = 30

export default function SettingsModal() {
  const { setIsSettingsOpen, userEmail, userName, setUserName, messages, convName, isPro, settingsInitialSection, setSettingsInitialSection, decisionTrackingEnabled, setDecisionTrackingEnabled } = useApp()
  const { theme, setTheme } = useTheme()
  const [section, setSection] = useState<Section>((settingsInitialSection as Section) ?? 'appearance')

  useEffect(() => {
    if (settingsInitialSection) setSettingsInitialSection(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    track('export_markdown', { message_count: messages.length })
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
    {
      id: 'memory',
      label: 'Memory',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 1.5h7a1.5 1.5 0 0 1 1.5 1.5v9.5L7 10 2 12.5V3a1.5 1.5 0 0 1 1.5-1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
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

              <SettingRow label="Decision tracking" description="Tag nodes as decided, rejected, considering and more — and see decisions across the tree. Experimental.">
                <Toggle on={decisionTrackingEnabled} onChange={(v) => { setDecisionTrackingEnabled(v); track('decision_tracking_toggled', { on: v }) }} />
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
          {section === 'usage' && <UsageTab isPro={isPro} onUpgrade={() => { track('upgrade_clicked', { source: 'settings' }); setIsSettingsOpen(false); window.location.href = '/upgrade' }} />}

          {/* ── Memory ── */}
          {section === 'memory' && <MemoryTab isPro={isPro} onUpgrade={() => { track('upgrade_clicked', { source: 'settings_memory' }); setIsSettingsOpen(false); window.location.href = '/upgrade' }} />}

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
  monthly_tokens?: number
  total_tokens?: number
  daily_reset_at: string
  monthly_reset_at?: string
}

function UsageTab({ isPro, onUpgrade }: { isPro: boolean; onUpgrade: () => void }) {
  const [usage, setUsage]           = useState<UsageRecord | null>(null)
  const [loading, setLoading]       = useState(true)
  const [upgrading, setUpgrading]   = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const DAILY_LIMIT   = isPro ? 50_000    : 25_000
  const MONTHLY_LIMIT = isPro ? 1_000_000 : 450_000

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
  const dailyUsed      = !usage || now >= new Date(usage.daily_reset_at) ? 0 : usage.daily_tokens
  const monthlyUsed    = !usage || !usage.monthly_reset_at || now >= new Date(usage.monthly_reset_at)
    ? 0
    : (usage.monthly_tokens ?? 0)
  const totalUsed      = usage?.total_tokens ?? 0
  const dailyResetAt   = usage ? new Date(usage.daily_reset_at) : null
  const monthlyResetAt = usage?.monthly_reset_at ? new Date(usage.monthly_reset_at) : null

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
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
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
        <div style={{ marginBottom: 16, borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Pro plan</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Manage billing or view invoices</div>
            </div>
            <button
              onClick={handleManage}
              disabled={upgrading}
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.6 : 1 }}
            >
              {upgrading ? 'Loading…' : 'Manage'}
            </button>
          </div>
          {!cancelConfirm ? (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCancelConfirm(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                Cancel subscription
              </button>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: 'var(--bg-base)' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Cancel your Pro subscription?</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                You&apos;ll keep Pro access until the end of your billing period. You can resubscribe any time.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleManage}
                  disabled={upgrading}
                  style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 500, cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.6 : 1 }}
                >
                  {upgrading ? 'Loading…' : 'Continue to cancel'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                >
                  Keep Pro
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--accent-bg)', border: '1px solid var(--user-bubble-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Upgrade to Pro</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>50k daily · 1M monthly tokens</div>
          </div>
          <button
            onClick={onUpgrade}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Upgrade
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

      <div style={{ marginTop: 20 }}>
        <UsageBar
          label="Monthly"
          used={monthlyUsed}
          limit={MONTHLY_LIMIT}
          pct={monthlyPct}
          color={barColor(monthlyPct)}
          resetLabel={monthlyResetAt ? `Resets ${fmtDate(monthlyResetAt)}` : ''}
        />
      </div>

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

// ── Memory tab ────────────────────────────────────────────────────────────────

function MemoryTab({ isPro, onUpgrade }: { isPro: boolean; onUpgrade: () => void }) {
  const [memories, setMemories]   = useState<MemoryRow[]>([])
  const [loading,  setLoading]    = useState(true)
  const [editing,  setEditing]    = useState<{ id: string; content: string } | null>(null)
  const [newText,  setNewText]    = useState('')
  const [adding,   setAdding]     = useState(false)
  const [error,    setError]      = useState<string | null>(null)

  async function reload() {
    const res = await fetch('/api/memory')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json() as { memories: MemoryRow[] }
    setMemories(data.memories ?? [])
    setLoading(false)
  }

  useEffect(() => { void reload() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newText.trim()
    if (!trimmed || adding) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/memory', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(
          data.error === 'limit_reached' ? `You can have at most ${MEMORY_MAX_ENTRIES} memories. Delete some first.` :
          data.error === 'too_long'      ? `Memories must be under ${MEMORY_MAX_LENGTH} characters.` :
          data.error === 'pro_required'  ? 'Adding memories requires Pro.' :
          'Could not save that memory.'
        )
      }
      setNewText('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit() {
    if (!editing) return
    const trimmed = editing.content.trim()
    if (!trimmed) return
    setError(null)
    const res = await fetch(`/api/memory/${editing.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: trimmed }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      setError(
        data.error === 'too_long'     ? `Memories must be under ${MEMORY_MAX_LENGTH} characters.` :
        data.error === 'pro_required' ? 'Editing memories requires Pro.' :
        'Could not save that change.'
      )
      return
    }
    setEditing(null)
    await reload()
  }

  async function handleDelete(id: string) {
    setError(null)
    const res = await fetch(`/api/memory/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Could not delete that memory.')
      return
    }
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 40, textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  // Free user with no memories — explanation + upgrade. Free users with
  // leftover memories from a prior Pro period still see the table so they can
  // delete or read them.
  if (!isPro && memories.length === 0) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Memory</h2>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a855f7', border: '1px solid #a855f7', borderRadius: 4, padding: '2px 7px' }}>
            PRO
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 18 }}>
          Memory lets Claude carry stable facts about you across every conversation, so you don&apos;t have to re-explain yourself in every chat.
        </p>

        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em', marginBottom: 10 }}>
          How it works
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { t: 'Saved automatically',  d: 'As you chat, stable facts about you get distilled into short memories.' },
            { t: 'Used everywhere',      d: 'Future conversations start with Claude already knowing the basics.' },
            { t: 'Fully in your control', d: 'Every memory is visible here. Edit, delete, or add your own anytime.' },
          ].map((row) => (
            <li key={row.t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div
                style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--accent-bg)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5.2l2.2 2.3L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{row.t}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 1 }}>{row.d}</div>
              </div>
            </li>
          ))}
        </ul>

        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em', marginBottom: 8 }}>
          Examples
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 22, fontStyle: 'italic' }}>
          &ldquo;User prefers concise answers without bullet lists.&rdquo;<br />
          &ldquo;User is building Nodea, a branching AI chat canvas.&rdquo;<br />
          &ldquo;User works primarily in TypeScript and Next.js.&rdquo;
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRadius: 12,
            background: 'linear-gradient(140deg, #0c0520 0%, #1a0b46 50%, #2a1870 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            boxShadow: '0 4px 20px rgba(92,33,182,0.18)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              Unlock Memory with Pro
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
              $8/mo, locked at the early-bird rate
            </div>
          </div>
          <button
            onClick={onUpgrade}
            style={{
              flexShrink: 0,
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#fff',
              color: '#1a0b46',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            Purchase Pro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Memory</h2>
        {isPro && (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a855f7', border: '1px solid #a855f7', borderRadius: 4, padding: '2px 7px' }}>
            PRO
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>
        Facts Claude carries across every conversation. {isPro
          ? 'Saved automatically as you chat. Edit or delete anything you don\'t want kept.'
          : 'Memory adds are paused on Free, but you can still view or delete what\'s here.'}
      </p>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            color: 'var(--color-error)',
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {memories.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            borderRadius: 10,
            border: '1px dashed var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-muted)',
            fontSize: 12,
            textAlign: 'center',
            marginBottom: 18,
          }}
        >
          Nothing saved yet. Memories appear here as Claude picks them up, or add one manually below.
        </div>
      ) : (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            marginBottom: 18,
          }}
        >
          {memories.map((m, i) => {
            const isEditing = editing?.id === m.id
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  borderBottom: i < memories.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isEditing ? 'var(--bg-subtle)' : 'transparent',
                }}
              >
                {isEditing ? (
                  <>
                    <textarea
                      value={editing.content}
                      onChange={(e) => setEditing({ id: m.id, content: e.target.value })}
                      maxLength={MEMORY_MAX_LENGTH}
                      rows={2}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        lineHeight: 1.45,
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={handleSaveEdit}
                        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                      {m.content}
                      {m.source === 'manual' && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          added manually
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {isPro && (
                        <button
                          title="Edit"
                          onClick={() => setEditing({ id: m.id, content: m.content })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0 }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M10.5 1.5l2 2-8 8-2.5.5.5-2.5 8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      <button
                        title="Delete"
                        onClick={() => handleDelete(m.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 3.5h9M5 3.5V2.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isPro && (
        <form onSubmit={handleAdd}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Add a memory</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              maxLength={MEMORY_MAX_LENGTH}
              rows={2}
              placeholder="e.g. User is a Next.js developer building a chat app called Nodea."
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: 12,
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.45,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!newText.trim() || adding || memories.length >= MEMORY_MAX_ENTRIES}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: (!newText.trim() || adding || memories.length >= MEMORY_MAX_ENTRIES) ? 'not-allowed' : 'pointer',
                opacity: (!newText.trim() || adding || memories.length >= MEMORY_MAX_ENTRIES) ? 0.5 : 1,
                flexShrink: 0,
                alignSelf: 'stretch',
              }}
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>{newText.length}/{MEMORY_MAX_LENGTH}</span>
            <span>{memories.length}/{MEMORY_MAX_ENTRIES} memories</span>
          </div>
        </form>
      )}
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

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        background: on ? 'var(--accent)' : 'var(--border-strong)',
        transition: 'background 0.15s',
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  )
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
