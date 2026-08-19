'use client'

import { useEffect, useState } from 'react'
import { useApp } from './App'
import { STANDARD_PRICE, type EarlyBirdStatus } from '@/lib/earlyBird'
import { LAST_CHANCE_PRICE, lastChanceActive } from '@/lib/lastChance'

const FEATURES = [
  { title: 'Claude Opus', desc: 'Our most capable model, reserved for Pro' },
  { title: '6× daily, 6× monthly tokens', desc: '300k daily · 3M monthly vs 50k · 500k on free' },
  { title: 'Automatic memory', desc: 'Nodea learns what matters about you as you chat' },
  { title: 'Early access', desc: 'First to try new Nodea features' },
]

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1.5 5.5l2.2 2.5 4.8-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function UpgradeModal() {
  const { setIsUpgradeOpen } = useApp()
  const [upgrading, setUpgrading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Price comes from the same server-side status that drives checkout, so the
  // button can never promise a rate the checkout won't honor. Until it loads,
  // the client-side campaign clock is a faithful stand-in — the last-chance
  // offer is time-boxed only (no seat cap), so active-by-clock IS active.
  const [status, setStatus] = useState<EarlyBirdStatus | null>(null)
  useEffect(() => {
    fetch('/api/early-bird')
      .then(r => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {})
  }, [])
  const price = status?.price ?? (lastChanceActive() ? LAST_CHANCE_PRICE : STANDARD_PRICE)
  const discounted = price < STANDARD_PRICE
  const discountPct = Math.round((1 - price / STANDARD_PRICE) * 100)

  async function handleUpgrade() {
    setUpgrading(true)
    setCheckoutError(null)
    try {
      const res  = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (data?.url) {
        window.location.href = data.url
        return
      }
      setCheckoutError(
        data?.error === 'already_pro'
          ? "You're already on Pro. Reload the app to see your plan."
          : 'Could not start checkout. Please try again, or email nodea.ai@gmail.com.',
      )
    } catch {
      setCheckoutError('Could not reach checkout. Check your connection and try again.')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.68)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 20,
      }}
      onClick={() => setIsUpgradeOpen(false)}
    >
      <div
        style={{
          width: 460,
          maxWidth: '100%',
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,92,246,0.3)',
          animation: 'upgradeIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Gradient header ── */}
        <div
          style={{
            background: 'linear-gradient(140deg, #0c0520 0%, #1a0b46 50%, #2a1870 100%)',
            padding: '36px 32px 30px',
            position: 'relative',
          }}
        >
          {/* Close */}
          <button
            onClick={() => setIsUpgradeOpen(false)}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)' }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Offer badge — only while a discount is actually live */}
          {discounted && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 11px',
                borderRadius: 99,
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.3)',
                color: '#fbbf24',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                marginBottom: 22,
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                <path d="M4 0l.88 2.7H7.6L5.34 4.38l.82 2.7L4 5.55 1.84 7.09l.82-2.7L.4 2.7H3.12L4 0Z" />
              </svg>
              {status?.offer === 'early_bird' ? 'EARLY BIRD PRICING' : 'LAST CHANCE PRICING'}
            </div>
          )}

          {/* Headline */}
          <h2
            style={{
              color: '#fff',
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.15,
              margin: '0 0 7px',
              fontFamily: 'var(--font-bricolage)',
              letterSpacing: '-0.5px',
            }}
          >
            Upgrade to Pro
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 13,
              margin: '0 0 30px',
              lineHeight: 1.5,
            }}
          >
            Lock in your rate before prices rise
          </p>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span
                style={{
                  color: '#fff',
                  fontSize: 68,
                  fontWeight: 800,
                  lineHeight: 1,
                  fontFamily: 'var(--font-bricolage)',
                  letterSpacing: '-3px',
                }}
              >
                ${price}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 17, fontWeight: 500 }}>
                /mo
              </span>
            </div>

            {discounted && (
              <div style={{ paddingBottom: 9, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span
                  style={{
                    color: 'rgba(255,255,255,0.28)',
                    fontSize: 14,
                    textDecoration: 'line-through',
                    textDecorationColor: 'rgba(255,255,255,0.25)',
                  }}
                >
                  ${STANDARD_PRICE}/mo
                </span>
                <span
                  style={{
                    color: '#fbbf24',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                >
                  {discountPct}% off, rate locked forever
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Features + CTA ── */}
        <div
          style={{
            background: 'var(--modal-bg)',
            padding: '26px 32px 30px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 26 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--user-bubble-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                    color: 'var(--accent)',
                  }}
                >
                  <CheckIcon />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              color: '#fff',
              border: 'none',
              cursor: upgrading ? 'not-allowed' : 'pointer',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              opacity: upgrading ? 0.7 : 1,
              transition: 'transform 0.12s, box-shadow 0.12s',
              boxShadow: upgrading ? 'none' : '0 4px 20px rgba(92,33,182,0.4)',
            }}
            onMouseEnter={(e) => {
              if (!upgrading) {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.transform = 'translateY(-1px)'
                btn.style.boxShadow = '0 8px 28px rgba(92,33,182,0.5)'
              }
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.transform = 'translateY(0)'
              btn.style.boxShadow = upgrading ? 'none' : '0 4px 20px rgba(92,33,182,0.4)'
            }}
          >
            {upgrading ? 'Redirecting…' : `Upgrade Now · $${price}/mo`}
          </button>

          {checkoutError && (
            <div role="alert" style={{ marginTop: 10, fontSize: 12, color: '#f87171', textAlign: 'center', lineHeight: 1.4 }}>
              {checkoutError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Cancel anytime · No commitments
            </p>
            <a
              href="/upgrade"
              target="_blank"
              rel="noopener"
              style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}
              onClick={() => setIsUpgradeOpen(false)}
            >
              Full details
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
