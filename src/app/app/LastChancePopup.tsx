'use client'

import { useEffect, useState } from 'react'
import { track } from '@vercel/analytics'
import { createClient } from '@/lib/supabase'
import { STANDARD_PRICE } from '@/lib/earlyBird'
import {
  LAST_CHANCE_PRICE,
  LAST_CHANCE_START,
  LAST_CHANCE_DEADLINE,
  LAST_CHANCE_DISCOUNT_PCT,
  LAST_CHANCE_SEEN_DAY_KEY,
  localDayKey,
  lastChanceShowsToday,
} from '@/lib/lastChance'

// Last-chance campaign popup (Aug 18-25, 2026): $12/mo locked for the life of
// the subscription, then the price is $24 for good. Unlike the one-time
// first-load popups, this one re-shows once per calendar day until the
// deadline — the seen-day is written on dismiss, and a new local day clears it
// (see lastChanceShowsToday). Free users only: Pro/admin accounts, and loads
// where the ConsentGate owns the screen, never see it.
//
// Sequencing: this popup outranks the other first-load popups while the
// campaign runs — WhatsNewNotice checks lastChanceShowsToday() and stands
// down, and the survey/memory prompts already key off the what's-new dismissed
// flag, so nothing can stack.
//
// Layout deliberately mirrors WhatsNewNotice / UseCaseSurveyModal, the sibling
// popups: same overlay, card width, radius, padding, and type scale. Keep them
// in step when any of them changes.

function countdownLabel(msLeft: number): string {
  let ms = Math.max(0, msLeft)
  const d = Math.floor(ms / 86_400_000); ms -= d * 86_400_000
  const h = Math.floor(ms / 3_600_000);  ms -= h * 3_600_000
  const m = Math.floor(ms / 60_000);     ms -= m * 60_000
  const s = Math.floor(ms / 1000)
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`
}

// Every item reads the same way as WhatsNewNotice: bold label, colon, one
// plain sentence. Copy matches the live /upgrade feature list — never promise
// here what that page doesn't.
const ITEMS: { label: string; body: string }[] = [
  { label: 'Claude Opus', body: 'our most capable model, reserved for Pro.' },
  { label: '6× the tokens', body: '300k a day and 3M a month, up from 50k and 500k on free.' },
  { label: 'Automatic memory', body: 'Nodea learns what matters about you as you chat.' },
  { label: 'Early access', body: 'first to try every new Nodea feature.' },
]

export default function LastChancePopup() {
  const [show, setShow] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!lastChanceShowsToday()) return
    let cancelled = false
    void (async () => {
      try {
        // ConsentGate owns the screen for not-yet-consented accounts; ask
        // again on the next load, same policy as MemoryImportPrompt.
        const consent = await fetch('/api/consent').then(r => (r.ok ? r.json() : null))
        if (cancelled || !consent?.termsAccepted) return

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled || !user) return
        // The pitch is "keep the rate from before the price went up". An
        // account born during the campaign never had that rate, and a paywall
        // as the first thing a day-0 user sees is the wrong first impression:
        // skip anyone created after the campaign opened.
        if (!user.created_at || new Date(user.created_at).getTime() >= new Date(LAST_CHANCE_START).getTime()) return
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('plan, is_admin, stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle()
        // Mirror the canonical Pro gate (src/lib/plan.ts): the pitch is for
        // free users; admins and paying subscribers never see it.
        const pro =
          profile?.is_admin === true ||
          (profile?.plan === 'pro' && !!profile?.stripe_customer_id)
        if (!cancelled && !pro) {
          setShow(true)
          track('last_chance_shown')
        }
      } catch { /* fail quiet — a nudge, never a blocker */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Tick the countdown only while visible; hide the moment the offer ends.
  useEffect(() => {
    if (!show) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [show])

  if (!show) return null

  const msLeft = new Date(LAST_CHANCE_DEADLINE).getTime() - now
  if (msLeft <= 0) return null

  function markSeenToday() {
    try { localStorage.setItem(LAST_CHANCE_SEEN_DAY_KEY, localDayKey()) } catch { /* ignore */ }
  }

  function dismiss() {
    markSeenToday()
    setShow(false)
    track('last_chance_dismissed')
  }

  function lockIn() {
    markSeenToday()
    track('last_chance_cta')
    window.location.assign('/upgrade')
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
        aria-label="Last chance: Pro for $12 a month"
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
          Last chance
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Pro for ${LAST_CHANCE_PRICE}/mo. Locked in forever.
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--accent-bg)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 16px',
            margin: '14px 0 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--text-secondary)',
                textDecoration: 'line-through',
                textDecorationThickness: 2.5,
                letterSpacing: '-0.02em',
              }}
            >
              ${STANDARD_PRICE}
            </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              ${LAST_CHANCE_PRICE}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>/mo</span>
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#fff',
                background: 'var(--accent)',
                borderRadius: 99,
                padding: '2px 7px',
                transform: 'translateY(-2px)',
              }}
            >
              {LAST_CHANCE_DISCOUNT_PCT}% off
            </span>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                textAlign: 'right',
                marginBottom: 3,
              }}
            >
              Offer ends in
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                letterSpacing: '0.01em',
              }}
            >
              {countdownLabel(msLeft)}
            </div>
          </div>
        </div>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 11,
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

        <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 14, marginBottom: 0 }}>
          ${LAST_CHANCE_PRICE}/mo applies for the life of your subscription, even as
          the standard price rises. Offer ends Monday, August 25 at 11:59pm PT.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={dismiss}
            style={{
              padding: '9px 16px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Maybe tomorrow
          </button>
          <button
            type="button"
            onClick={lockIn}
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
            Lock in ${LAST_CHANCE_PRICE}/mo
          </button>
        </div>
      </div>
    </div>
  )
}
