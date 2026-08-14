'use client'

import { useEffect, useState } from 'react'
import { track } from '@vercel/analytics'
import { X } from 'lucide-react'
import { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT } from '@/lib/token-limits'

// One-time "what's new" popup for the 2026-08 release: Sonnet 5 as the
// baseline model, raised token caps, and memory import. Shows first, before
// the survey and memory-import popups (both check WHATS_NEW_DISMISSED_KEY and
// wait for the next load), so two overlays never stack. Dismissed state lives
// in localStorage under a release-specific key; a future release ships a new
// key (and its own copy) rather than reusing this one.
export const WHATS_NEW_DISMISSED_KEY = 'nodea_whatsnew_20260813'

const fmt = (n: number) => `${Math.round(n / 1000)}k`

export default function WhatsNewNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(WHATS_NEW_DISMISSED_KEY) !== '1') setShow(true)
    } catch { /* private mode: show, it just re-appears next visit */ setShow(true) }
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
        onClick={e => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--bg-elevated, var(--bg-subtle))',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
          padding: '20px 22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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
          <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)' }}>
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
            <X size={16} />
          </button>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            fontSize: 13.5,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Claude Sonnet 5</strong> now powers
            every chat, free plan included.
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Much higher limits:</strong>{' '}
            {fmt(FREE_DAILY_LIMIT)} tokens/day free, {fmt(PRO_DAILY_LIMIT)}/day on Pro.
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Memory import:</strong> bring your
            saved memories over from Claude or ChatGPT in Settings&nbsp;&rarr;&nbsp;Memory.
          </li>
        </ul>
        <button
          type="button"
          onClick={dismiss}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '9px 0',
            borderRadius: 9,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
