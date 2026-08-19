'use client'

import { useEffect, useState } from 'react'
import { track } from '@vercel/analytics'
import { createClient } from '@/lib/supabase'
import { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT } from '@/lib/token-limits'
import { lastChanceShowsToday } from '@/lib/lastChance'

// One-time "what's new" popup for the 2026-08 release: Sonnet 5 as the
// baseline model, raised token caps, and memory import. Shows first, before
// the survey and memory-import popups (both check WHATS_NEW_DISMISSED_KEY and
// wait for the next load), so two overlays never stack. Dismissed state lives
// in localStorage under a release-specific key; a future release ships a new
// key (and its own copy) rather than reusing this one.
//
// Layout deliberately mirrors UseCaseSurveyModal, the sibling first-load
// popup: same overlay, card width, radius, padding, type scale, and a single
// right-aligned primary button. Keep them in step when either one changes.
export const WHATS_NEW_DISMISSED_KEY = 'nodea_whatsnew_20260813'

// Accounts created on or after the release ship with these changes as their
// baseline; a changelog about "what changed" is meaningless to them.
const RELEASE_AT = '2026-08-13T00:00:00Z'

const fmt = (n: number) => `${Math.round(n / 1000)}k`

// Every item reads the same way: bold label, colon, one plain sentence.
const ITEMS: { label: string; body: string }[] = [
  {
    label: 'Sonnet 5 on every chat',
    body: "Claude's newest model is now the default for all conversations, free plan included.",
  },
  {
    label: 'Much higher limits',
    body: `${fmt(FREE_DAILY_LIMIT)} tokens a day on free, ${fmt(PRO_DAILY_LIMIT)} a day on Pro.`,
  },
  {
    label: 'Memory import',
    body: 'Bring what Claude or ChatGPT already knows about you into Nodea, from Settings → Memory.',
  },
]

export default function WhatsNewNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // The last-chance campaign popup outranks this one while it runs (revenue
    // beats changelog); this notice resumes on the next load after the
    // campaign popup is dismissed for the day, or once the campaign ends.
    if (lastChanceShowsToday()) return
    try {
      if (localStorage.getItem(WHATS_NEW_DISMISSED_KEY) === '1') return
    } catch { /* private mode: show, it just re-appears next visit */ }
    let cancelled = false
    void (async () => {
      let show = true
      try {
        const { data: { user } } = await createClient().auth.getUser()
        if (cancelled) return
        if (user?.created_at && new Date(user.created_at).getTime() >= new Date(RELEASE_AT).getTime()) {
          // Post-release account: stamp the notice as read so the survey and
          // memory-import prompts (which wait on this key) get their turn.
          try { localStorage.setItem(WHATS_NEW_DISMISSED_KEY, '1') } catch { /* ignore */ }
          show = false
        }
      } catch { /* auth hiccup: fall through and show, same as before */ }
      if (!cancelled && show) setShow(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(WHATS_NEW_DISMISSED_KEY, '1') } catch { /* ignore */ }
    track('whats_new_dismissed', { release: '20260813' })
  }

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
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What's new in Nodea"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(460px, calc(100vw - 32px))',
          borderRadius: 16,
          background: 'var(--modal-bg)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          padding: '26px 26px 22px',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#fff',
            background: 'var(--accent)',
            borderRadius: 99,
            padding: '3px 9px',
            marginBottom: 12,
          }}
        >
          New
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Nodea just got a big upgrade
        </div>
        {/* --text-muted is only ~2.4:1 on the dark card, so readable copy uses
            --text-secondary (see the same note in MemoryImportModal). */}
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '5px 0 18px', lineHeight: 1.5 }}>
          Three changes landed today. Nothing to set up, they are already on.
        </p>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {ITEMS.map((item) => (
            <li key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span
                aria-hidden="true"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  flexShrink: 0,
                  transform: 'translateY(-2px)',
                }}
              />
              <span style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                <strong style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{item.label}:</strong>{' '}
                {item.body}
              </span>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
          <button
            type="button"
            onClick={dismiss}
            style={{
              padding: '9px 22px',
              borderRadius: 9,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
