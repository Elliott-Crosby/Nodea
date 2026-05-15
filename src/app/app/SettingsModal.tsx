'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/theme'
import { useApp } from './App'
import { createClient } from '@/lib/supabase'

type Section = 'appearance' | 'account'

export default function SettingsModal() {
  const { setIsSettingsOpen, userEmail, userName, setUserName } = useApp()
  const { theme, setTheme } = useTheme()
  const [section, setSection] = useState<Section>('appearance')

  // Account form state
  const [displayName, setDisplayName] = useState(userName)
  const [newEmail, setNewEmail] = useState(userEmail)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
      setCurrentPw('')
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

          {/* Future placeholders */}
          <div style={{ padding: '12px 16px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Coming Soon
          </div>
          {['Integrations', 'Notifications', 'Keyboard Shortcuts', 'Export'].map((name) => (
            <div
              key={name}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                color: 'var(--text-muted)',
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
            >
              {name}
            </div>
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

              <SettingRow
                label="Theme"
                description="Switch between light and dark mode"
              >
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

              {/* Future appearance settings */}
              {[
                ['Font Size', 'Adjust the text size in the chat panel', 'Medium (default)'],
                ['Compact Mode', 'Reduce spacing between messages', 'Off'],
                ['Animations', 'Enable transition animations', 'On'],
              ].map(([label, desc, val]) => (
                <SettingRow key={label} label={label} description={desc}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>{val} · Coming soon</span>
                </SettingRow>
              ))}
            </div>
          )}

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
