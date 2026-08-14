'use client'

import { useEffect, useState } from 'react'
import { track } from '@vercel/analytics'
import { X } from 'lucide-react'
import { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT } from '@/lib/token-limits'

// One-time "what's new" card for the 2026-08 release: Sonnet 5 as the baseline
// model, raised token caps, and memory import. Non-blocking corner card —
// never stacks a third modal on the survey/consent sequence. Dismissed state
// lives in localStorage under a release-specific key; a future release ships
// a new key (and its own copy) rather than reusing this one.
const DISMISS_KEY = 'nodea_whatsnew_20260813'

const fmt = (n: number) => `${Math.round(n / 1000)}k`

export default function WhatsNewNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== '1') setShow(true)
    } catch { /* private mode — show, it just re-appears next visit */ setShow(true) }
  }, [])

  if (!show) return null

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    track('whats_new_dismissed', { release: '20260813' })
  }

  return (
    <div
      role="region"
      aria-label="What's new in Nodea"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: 320,
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 900, // under modals (1000) and ConsentGate (9999)
        background: 'var(--bg-elevated, var(--bg-subtle))',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#fff',
            background: 'var(--accent)',
            borderRadius: 99,
            padding: '2px 8px',
          }}
        >
          New
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
          Nodea just got a big upgrade
        </span>
        <button
          type="button"
          aria-label="Dismiss what's new"
          onClick={dismiss}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            padding: 2,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 12.5,
          lineHeight: 1.45,
          color: 'var(--text-secondary)',
        }}
      >
        <li>
          <strong style={{ color: 'var(--text-primary)' }}>Claude Sonnet 5</strong> now powers
          every chat — free plan included.
        </li>
        <li>
          <strong style={{ color: 'var(--text-primary)' }}>Much higher limits</strong> —{' '}
          {fmt(FREE_DAILY_LIMIT)} tokens/day free, {fmt(PRO_DAILY_LIMIT)}/day on Pro.
        </li>
        <li>
          <strong style={{ color: 'var(--text-primary)' }}>Memory import</strong> — bring your
          saved memories over from Claude or ChatGPT in Settings&nbsp;&rarr;&nbsp;Memory.
        </li>
      </ul>
    </div>
  )
}
