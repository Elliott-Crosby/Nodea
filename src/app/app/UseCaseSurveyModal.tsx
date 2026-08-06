'use client'

import { useState } from 'react'
import { track } from '@vercel/analytics'
import { useApp } from './App'
import {
  USE_CASE_OPTIONS,
  USE_CASE_OTHER_KEY,
  USE_CASES_OTHER_MAX,
  USE_CASE_SURVEY_DISMISSED_KEY,
} from '@/lib/useCases'

// One-time "What do you use Nodea for?" popup. App.tsx opens it when the
// profile has no stored answer (use_cases === null) and the user hasn't
// skipped before. Saving writes the profile; skipping sets a localStorage
// flag so it never nags — Settings → Account keeps the answer editable.
export default function UseCaseSurveyModal() {
  const { setIsSurveyOpen, saveUseCases, useCases, useCasesOther } = useApp()

  const [selected, setSelected] = useState<string[]>(useCases ?? [])
  const [other, setOther] = useState(useCasesOther ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const hasOther = selected.includes(USE_CASE_OTHER_KEY)
  const canSave = selected.length > 0 && (!hasOther || other.trim().length > 0)

  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    setError(false)
    const ok = await saveUseCases(selected, hasOther ? other : null)
    if (ok) {
      track('use_case_survey_saved', { source: 'app_popup', count: selected.length })
      setIsSurveyOpen(false)
    } else {
      setError(true)
      setSaving(false)
    }
  }

  function handleSkip() {
    try { localStorage.setItem(USE_CASE_SURVEY_DISMISSED_KEY, '1') } catch { /* private mode */ }
    track('use_case_survey_skipped')
    setIsSurveyOpen(false)
  }

  const chip = (on: boolean): React.CSSProperties => ({
    padding: '7px 13px',
    borderRadius: 99,
    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: on ? 'var(--accent)' : 'var(--bg-subtle)',
    color: on ? '#fff' : 'var(--text-primary)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.12s ease',
  })

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
      onClick={handleSkip}
    >
      <div
        style={{
          width: 'min(460px, calc(100vw - 32px))',
          borderRadius: 16,
          background: 'var(--modal-bg)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          padding: '26px 26px 22px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          What do you use Nodea for?
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '5px 0 16px', lineHeight: 1.5 }}>
          Pick everything that fits — it helps us decide what to build next.
          You can change this any time in Settings.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: hasOther ? 10 : 18 }}>
          {USE_CASE_OPTIONS.map((o) => (
            <button key={o.key} type="button" style={chip(selected.includes(o.key))} onClick={() => toggle(o.key)}>
              {o.label}
            </button>
          ))}
          <button type="button" style={chip(hasOther)} onClick={() => toggle(USE_CASE_OTHER_KEY)}>
            Other
          </button>
        </div>

        {hasOther && (
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={USE_CASES_OTHER_MAX}
            placeholder="Tell us in a few words…"
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: 13,
              marginBottom: 16,
            }}
          />
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>
            Couldn&rsquo;t save right now — try again, or find this later in Settings.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12.5,
              cursor: 'pointer',
              padding: '8px 4px',
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              padding: '9px 22px',
              borderRadius: 9,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: !canSave || saving ? 'not-allowed' : 'pointer',
              opacity: !canSave || saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
