'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { Sun, Moon, User, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { USE_CASE_OPTIONS, USE_CASE_OTHER_KEY, USE_CASES_OTHER_MAX } from '@/lib/useCases'
import AmbientTree from '../login/AmbientTree'
import '../login/login.css'

export default function WelcomePage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Optional "what will you use Nodea for?" answer, saved alongside the name.
  const [cases, setCases] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')

  function toggleCase(key: string) {
    setCases((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  // Gate: if not signed in → /login. If already has a display name → /app.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        router.replace('/login')
        return
      }
      const existing = user.user_metadata?.display_name
      if (typeof existing === 'string' && existing.trim().length > 0) {
        router.replace('/app')
        return
      }
      setChecking(false)
    })()
    return () => { cancelled = true }
  }, [router, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError('Please enter a name.')
      return
    }
    if (trimmed.length > 60) {
      setError('Please keep it under 60 characters.')
      return
    }

    setSaving(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        data: { display_name: trimmed },
      })
      if (updateErr) throw updateErr
      track('display_name_set')

      // Best-effort survey save — if this write fails (e.g. migration lag)
      // the in-app popup re-asks, so account creation is never blocked on it.
      if (cases.length > 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const otherTrimmed = cases.includes(USE_CASE_OTHER_KEY) && otherText.trim().length > 0
              ? otherText.trim().slice(0, USE_CASES_OTHER_MAX)
              : null
            const payload = {
              use_cases: cases,
              use_cases_other: otherTrimmed,
              use_cases_updated_at: new Date().toISOString(),
            }
            // Update-then-insert: fresh accounts usually have no profile row
            // yet, and the locked-down insert policy accepts a defaults-only
            // row carrying just these columns.
            const { data: updated } = await supabase
              .from('user_profiles').update(payload).eq('user_id', user.id).select('user_id')
            if (!updated || updated.length === 0) {
              await supabase.from('user_profiles').insert({ user_id: user.id, ...payload })
            }
            track('use_case_survey_saved', { source: 'welcome', count: cases.length })
          }
        } catch { /* non-blocking */ }
      }

      window.location.href = '/app'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <div className="au-root">

      <aside className="au-brand">
        <div className="au-brand-top">
          <Link href="/" className="au-wordmark">Nodea</Link>
        </div>

        <div className="au-brand-stage">
          <AmbientTree />
        </div>

        <div className="au-brand-foot">
          <h2>Think in <em className="au-accent">branches.</em></h2>
          <p className="au-brand-sub">
            Every conversation in Nodea becomes a map. Branch from any answer, compare paths,
            and keep the keepers &mdash; without losing the thread.
          </p>
        </div>
      </aside>

      <div className="au-form-wrap">

        <div className="au-utility">
          <Link href="/" className="au-wordmark au-wordmark-mobile">Nodea</Link>
          <button
            type="button"
            className="au-theme-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="au-form-wrap-inner">

          <div className="au-header">
            <div className="au-eyebrow">
              <span className="au-eyebrow-dot" />
              ONE LAST THING
            </div>
            <h1 className="au-h1">What should we <em className="au-accent">call you?</em></h1>
            <p className="au-sub">
              This is the name Nodea will use in your canvas. You can change it any time from Settings.
            </p>
          </div>

          {error && (
            <div className="au-banner au-banner-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!checking && (
            <form className="au-form" onSubmit={handleSubmit} noValidate>
              <div className="au-field">
                <label className="au-label" htmlFor="display-name">Your name</label>
                <div className="au-input-shell">
                  <User size={16} className="au-input-icon" />
                  <input
                    id="display-name"
                    type="text"
                    className="au-input"
                    placeholder="e.g. Alex"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={60}
                    autoComplete="given-name"
                    autoFocus
                  />
                </div>
              </div>

              <div className="au-field">
                <label className="au-label">
                  What will you use Nodea for? <span style={{ opacity: 0.55, fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {USE_CASE_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => toggleCase(o.key)}
                      style={{
                        padding: '7px 13px',
                        borderRadius: 99,
                        border: `1px solid ${cases.includes(o.key) ? 'var(--accent, #7c3aed)' : 'rgba(128,128,128,0.35)'}`,
                        background: cases.includes(o.key) ? 'var(--accent, #7c3aed)' : 'transparent',
                        color: cases.includes(o.key) ? '#fff' : 'inherit',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => toggleCase(USE_CASE_OTHER_KEY)}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 99,
                      border: `1px solid ${cases.includes(USE_CASE_OTHER_KEY) ? 'var(--accent, #7c3aed)' : 'rgba(128,128,128,0.35)'}`,
                      background: cases.includes(USE_CASE_OTHER_KEY) ? 'var(--accent, #7c3aed)' : 'transparent',
                      color: cases.includes(USE_CASE_OTHER_KEY) ? '#fff' : 'inherit',
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    Other
                  </button>
                </div>
                {cases.includes(USE_CASE_OTHER_KEY) && (
                  <div className="au-input-shell" style={{ marginTop: 8 }}>
                    <input
                      type="text"
                      className="au-input"
                      placeholder="Tell us in a few words…"
                      value={otherText}
                      onChange={e => setOtherText(e.target.value)}
                      maxLength={USE_CASES_OTHER_MAX}
                    />
                  </div>
                )}
              </div>

              <button type="submit" className="au-submit" disabled={saving || name.trim().length === 0}>
                {saving && <span className="au-spinner" aria-hidden="true" />}
                {saving ? 'Just a sec…' : 'Continue'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
