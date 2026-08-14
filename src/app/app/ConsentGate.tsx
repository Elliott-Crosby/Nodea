'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Blocking terms/privacy gate for the app surface. Users who accepted at
// signup (metadata → self-healed by GET /api/consent) never see it; everyone
// else — accounts predating the consent flow — must agree before continuing.
// Deliberately non-dismissable: no backdrop click, no escape, no close button.
// The marketing checkbox rides along but stays optional and unchecked.

type Phase = 'checking' | 'needed' | 'done'

export default function ConsentGate() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [agree, setAgree] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/consent')
      .then(r => (r.ok ? r.json() : null))
      .then(state => {
        if (cancelled) return
        // Fail open on fetch/auth errors — the gate must never brick the app
        // when the API is briefly unavailable; it re-checks next load.
        if (!state) setPhase('done')
        else setPhase(state.termsAccepted ? 'done' : 'needed')
      })
      .catch(() => { if (!cancelled) setPhase('done') })
    return () => { cancelled = true }
  }, [])

  if (phase !== 'needed') return null

  async function submit() {
    if (!agree) { setShowHint(true); return }
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptTerms: true, marketingOptIn: marketing }),
      })
      if (!r.ok) throw new Error('Could not save — please try again.')
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Terms of Service agreement required"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: 'min(440px, 100%)', background: 'var(--ai-card-bg, var(--bg, #fff))',
        border: '1px solid var(--border, #e5e5e5)', borderRadius: 14,
        padding: '28px 26px', color: 'var(--text-primary, #111)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>One thing before you continue</h2>
        <p style={{ margin: '10px 0 18px', fontSize: 14, lineHeight: 1.55, color: 'var(--text-muted, #666)' }}>
          To keep using Nodea, please review and agree to our terms. This is a
          one-time step for accounts created before we added it.
        </p>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={agree}
            onChange={e => { setAgree(e.target.checked); if (e.target.checked) setShowHint(false) }}
            style={{ marginTop: 3 }}
          />
          <span>
            I agree to the{' '}
            <Link href="/terms" target="_blank" style={{ color: 'var(--accent, #7c3aed)', textDecoration: 'underline' }}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" style={{ color: 'var(--accent, #7c3aed)', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </span>
        </label>
        {showHint && (
          <div style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>
            You need to agree to the Terms to keep using Nodea.
          </div>
        )}

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, cursor: 'pointer', color: 'var(--text-muted, #666)', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={marketing}
            onChange={e => setMarketing(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>Email me occasional product updates and tips. Optional — unsubscribe anytime in Settings.</span>
        </label>

        {error && (
          <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{error}</div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 9, border: 'none',
            background: 'var(--accent, #7c3aed)', color: '#fff', fontSize: 14.5,
            fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Agree & continue'}
        </button>
      </div>
    </div>
  )
}
