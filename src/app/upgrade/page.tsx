'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import { createClient } from '@/lib/supabase'

const FEATURES = [
  { title: 'Claude Opus', desc: 'Our most capable model, reserved for Pro' },
  { title: '2× daily tokens', desc: '50k daily tokens vs 25k on free' },
  { title: '1M monthly tokens', desc: '2.2× the free monthly budget (450k)' },
  { title: 'Smarter model routing', desc: 'Right model selected for every message' },
  { title: 'Early access', desc: 'First to try new Nodea features' },
]

const COMPARE = [
  { label: 'Daily tokens',      free: '25k',  pro: '50k'  },
  { label: 'Monthly tokens',    free: '450k', pro: '1M'   },
  { label: 'Claude Haiku',      free: true,   pro: true   },
  { label: 'Claude Sonnet',     free: true,   pro: true   },
  { label: 'Claude Opus',       free: false,  pro: true   },
  { label: 'Early access',      free: false,  pro: true   },
]

function CheckIcon({ on }: { on: boolean }) {
  if (on) {
    return (
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: 'var(--accent-bg)', border: '1px solid var(--user-bubble-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', flexShrink: 0,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5.5l2.2 2.5 4.8-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: 'var(--bg-muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', flexShrink: 0,
    }}>
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  )
}

type AuthState = 'loading' | 'anonymous' | 'free' | 'pro'

export default function UpgradePage() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [upgrading, setUpgrading] = useState(false)
  const [managing, setManaging]   = useState(false)

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthState('anonymous'); return }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('plan, is_admin')
        .eq('user_id', user.id)
        .maybeSingle()
      setAuthState(profile?.plan === 'pro' || profile?.is_admin === true ? 'pro' : 'free')
    })()
  }, [])

  async function handleUpgrade() {
    setUpgrading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setUpgrading(false)
    }
  }

  async function handleManage() {
    setManaging(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setManaging(false)
    }
  }

  return (
    <div className="ln-root" style={{ background: 'var(--bg-base)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '72px 20px 96px',
        }}
      >
        {/* Hero text */}
        <div style={{ textAlign: 'center', marginBottom: 52, maxWidth: 520 }}>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 800,
              fontFamily: 'var(--font-bricolage)',
              color: 'var(--text-primary)',
              letterSpacing: '-1px',
              margin: '0 0 14px',
              lineHeight: 1.1,
            }}
          >
            Simple, honest pricing
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Start free. Upgrade when you need more.
          </p>
        </div>

        {/* Plan cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
            width: '100%',
            maxWidth: 640,
            marginBottom: 56,
          }}
        >
          {/* Free card */}
          <div
            style={{
              borderRadius: 16,
              border: '1px solid var(--border)',
              background: 'var(--modal-bg)',
              padding: '28px 28px 24px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>FREE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 42, fontWeight: 800, fontFamily: 'var(--font-bricolage)', color: 'var(--text-primary)', letterSpacing: '-2px', lineHeight: 1 }}>$0</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/mo</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
                A full experience with generous daily and monthly limits.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 24 }}>
              {['25k daily · 450k monthly tokens', 'Claude Haiku & Sonnet', 'Unlimited branches'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckIcon on={true} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'auto' }}>
              {authState === 'anonymous' && (
                <Link
                  href="/login"
                  className="ln-btn ln-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}
                >
                  Get started free
                </Link>
              )}
              {(authState === 'free' || authState === 'loading') && (
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    padding: '10px 0',
                    fontWeight: 500,
                  }}
                >
                  {authState === 'free' ? 'Your current plan' : ''}
                </div>
              )}
              {authState === 'pro' && (
                <Link
                  href="/app"
                  className="ln-btn ln-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}
                >
                  Back to app
                </Link>
              )}
            </div>
          </div>

          {/* Pro card */}
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(139,92,246,0.35)',
              background: 'var(--modal-bg)',
              boxShadow: '0 0 0 1px rgba(139,92,246,0.12), 0 16px 48px rgba(0,0,0,0.12)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Gradient header */}
            <div
              style={{
                background: 'linear-gradient(140deg, #0c0520 0%, #1a0b46 50%, #2a1870 100%)',
                padding: '28px 28px 24px',
              }}
            >
              {/* Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 99,
                  background: 'rgba(251,191,36,0.12)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  color: '#fbbf24',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  marginBottom: 14,
                }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                  <path d="M4 0l.88 2.7H7.6L5.34 4.38l.82 2.7L4 5.55 1.84 7.09l.82-2.7L.4 2.7H3.12L4 0Z" />
                </svg>
                EARLY BIRD
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>PRO</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 42, fontWeight: 800, fontFamily: 'var(--font-bricolage)', color: '#fff', letterSpacing: '-2px', lineHeight: 1 }}>$8</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>/mo</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through', marginLeft: 6 }}>$15</span>
              </div>
              <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, margin: '0 0 4px', letterSpacing: '0.02em' }}>47% off — rate locked forever</p>
            </div>

            <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 24 }}>
                {FEATURES.map(f => (
                  <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <CheckIcon on={true} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto' }}>
                {authState === 'pro' ? (
                  <button
                    onClick={handleManage}
                    disabled={managing}
                    style={{
                      width: '100%',
                      padding: '13px 20px',
                      borderRadius: 10,
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: managing ? 'not-allowed' : 'pointer',
                      opacity: managing ? 0.6 : 1,
                    }}
                  >
                    {managing ? 'Loading…' : 'Manage billing'}
                  </button>
                ) : authState === 'anonymous' ? (
                  <Link
                    href="/login?next=/upgrade"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '13px 20px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      textDecoration: 'none',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      boxShadow: '0 4px 20px rgba(92,33,182,0.4)',
                    }}
                  >
                    Get Pro · $8/mo
                  </Link>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading || authState === 'loading'}
                    style={{
                      width: '100%',
                      padding: '13px 20px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                      color: '#fff',
                      border: 'none',
                      cursor: (upgrading || authState === 'loading') ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      opacity: (upgrading || authState === 'loading') ? 0.7 : 1,
                      boxShadow: '0 4px 20px rgba(92,33,182,0.4)',
                    }}
                  >
                    {upgrading ? 'Redirecting…' : 'Upgrade Now · $8/mo'}
                  </button>
                )}
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
                  Cancel anytime. No long-term commitments.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison table */}
        <div style={{ width: '100%', maxWidth: 560 }}>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: 14,
              textAlign: 'center',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Plan comparison
          </h2>
          <div
            style={{
              borderRadius: 14,
              border: '1px solid var(--border)',
              overflow: 'hidden',
              background: 'var(--modal-bg)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 100px',
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>FEATURE</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textAlign: 'center' }}>FREE</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textAlign: 'center' }}>PRO</span>
            </div>

            {COMPARE.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 100px',
                  padding: '14px 20px',
                  borderBottom: i < COMPARE.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{row.label}</span>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {typeof row.free === 'string' ? (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{row.free}</span>
                  ) : (
                    <CheckIcon on={row.free} />
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {typeof row.pro === 'string' ? (
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{row.pro}</span>
                  ) : (
                    <CheckIcon on={row.pro} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
