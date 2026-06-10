'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { track } from '@vercel/analytics'
import { Sun, Moon, Mail, Lock, AlertTriangle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import AmbientTree from './AmbientTree'
import './login.css'

type Mode = 'signin' | 'signup' | 'forgot'

/* ── Password strength ──────────────────────────────────────── */
function strengthScore(p: string): number {
  if (!p) return 0
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) s++
  return Math.min(4, s)
}
const STRENGTH_LABELS = ['', 'too short', 'weak', 'fair', 'good', 'strong']
const STRENGTH_COLORS = ['', '#f87171', '#fbbf24', '#facc15', '#34d399', '#34d399']

/* ── Main component ─────────────────────────────────────────── */
function LoginForm() {
  const { theme, toggleTheme } = useTheme()
  const supabase = createClient()
  const searchParams = useSearchParams()

  // CTAs across the site deep-link to /login?mode=signup so new visitors
  // land on the signup form, not "welcome back".
  const initialMode: Mode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin'

  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({})

  useEffect(() => {
    if (initialMode === 'signup') track('signup_started')
  }, [initialMode])

  function switchMode(next: Mode) {
    if (next === 'signup') track('signup_started')
    setMode(next)
    setError(null)
    setSuccess(null)
    setTouched({})
  }

  const emailInvalid = !!(touched.email && !/.+@.+\..+/.test(email))
  const pwdInvalid = !!(touched.password && mode === 'signup' && password.length < 8)
  const score = mode === 'signup' && password.length > 0 ? strengthScore(password) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Client-side validation
    if (!/.+@.+\..+/.test(email)) {
      setTouched(t => ({ ...t, email: true }))
      return
    }
    if (mode !== 'forgot' && !password) {
      setTouched(t => ({ ...t, password: true }))
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
        })
        if (error) throw error
        track('signup_completed')
        if (data.session) {
          setSuccess('Account created. One quick question…')
          setTimeout(() => { window.location.href = '/welcome' }, 800)
        } else {
          setSuccess('Check your email to confirm your account.')
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login/update-password`,
        })
        if (error) throw error
        track('password_reset_requested')
        setSuccess('Password reset link sent — check your email.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        track('login', { method: 'email' })
        setSuccess('Signed in. Redirecting to your canvas…')
        setTimeout(() => { window.location.href = '/app' }, 800)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  /* ── Computed labels ── */
  const eyebrow = mode === 'signin' ? 'WELCOME BACK' : mode === 'signup' ? 'NEW HERE' : 'RESET'

  const headline =
    mode === 'signin' ? <>Open your <em className="au-accent">canvas.</em></> :
    mode === 'signup' ? <>Start <em className="au-accent">branching.</em></> :
                        <>Reset your <em className="au-accent">password.</em></>

  const subCopy =
    mode === 'signin' ? 'Sign in to pick up where your last branch left off.' :
    mode === 'signup' ? 'Free while in beta. No credit card. Open an account, open a canvas.' :
                        "Enter the email you signed up with — we'll send you a reset link."

  const submitLabel =
    loading        ? 'Just a sec…' :
    mode === 'signin'  ? 'Sign in' :
    mode === 'signup'  ? 'Create account' :
                         'Send reset link'

  /* ── Render ── */
  return (
    <div className="au-root">

      {/* ── Brand panel ── */}
      <aside className="au-brand">
        <div className="au-brand-top">
          <Link href="/" className="au-wordmark">Nodea</Link>
          <Link href="/" className="au-back">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M7 2L4 5.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            back to site
          </Link>
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
          <blockquote className="au-quote">
            <p>&ldquo;It&apos;s the first AI app that feels like the way I actually think &mdash; recursively, with a lot of half-finished detours.&rdquo;</p>
            <cite className="au-who">&mdash; a private-beta user</cite>
          </blockquote>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <div className="au-form-wrap">

        {/* Utility bar */}
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

          {/* Header */}
          <div className="au-header">
            <div className="au-eyebrow">
              <span className="au-eyebrow-dot" />
              {eyebrow}
            </div>
            <h1 className="au-h1">{headline}</h1>
            <p className="au-sub">{subCopy}</p>
          </div>

          {/* Tab switcher */}
          {mode !== 'forgot' && (
            <div className="au-tabs" role="tablist">
              <div className={`au-tab-indicator${mode === 'signup' ? ' right' : ''}`} aria-hidden="true" />
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                className={`au-tab${mode === 'signin' ? ' active' : ''}`}
                onClick={() => switchMode('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={`au-tab${mode === 'signup' ? ' active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                Sign up
              </button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="au-banner au-banner-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="au-banner au-banner-success" role="status">
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Form */}
          <form className="au-form" onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="au-field">
              <div className="au-field-label-row">
                <label className="au-label" htmlFor="email">Email</label>
                {emailInvalid && <span className="au-field-hint au-field-hint-error">Invalid email</span>}
              </div>
              <div className={`au-input-shell${emailInvalid ? ' has-error' : ''}`}>
                <Mail size={16} className="au-input-icon" />
                <input
                  id="email"
                  type="email"
                  className="au-input"
                  placeholder="you@thinking.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, email: true }))}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            {mode !== 'forgot' && (
              <div className="au-field">
                <div className="au-field-label-row">
                  <label className="au-label" htmlFor="password">Password</label>
                  {mode === 'signin' && (
                    <button type="button" className="au-field-link" onClick={() => switchMode('forgot')}>
                      Forgot?
                    </button>
                  )}
                  {pwdInvalid && <span className="au-field-hint au-field-hint-error">Min 8 characters</span>}
                </div>
                <div className={`au-input-shell${pwdInvalid ? ' has-error' : ''}`}>
                  <Lock size={16} className="au-input-icon" />
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    className="au-input"
                    placeholder={mode === 'signup' ? 'pick something good' : '••••••••'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, password: true }))}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button type="button" className="au-input-toggle" onClick={() => setShowPwd(s => !s)}>
                    {showPwd ? 'Hide' : 'Show'}
                  </button>
                </div>

                {/* Strength meter (signup only) */}
                {mode === 'signup' && password.length > 0 && (
                  <div className="au-pwd-meter">
                    <div className="au-pwd-bars">
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className="au-pwd-bar"
                          style={{ background: i <= score ? STRENGTH_COLORS[score] : undefined }}
                        />
                      ))}
                    </div>
                    <span className="au-pwd-meta" style={{ color: STRENGTH_COLORS[score] }}>
                      {STRENGTH_LABELS[score]} &middot; {password.length} chars
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Checkbox — "remember me" for signin */}
            {mode === 'signin' && (
              <label className="au-checkbox-row">
                <input
                  type="checkbox"
                  className="au-checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                <span>Keep me signed in on this device</span>
              </label>
            )}

            {/* Submit */}
            <button type="submit" className="au-submit" disabled={loading || !!success}>
              {loading && <span className="au-spinner" aria-hidden="true" />}
              {submitLabel}
            </button>

            {/* Implicit consent — signup only */}
            {mode === 'signup' && (
              <p className="au-consent">
                By creating an account you agree to the{' '}
                <Link href="/terms" className="au-field-link">Terms</Link> and{' '}
                <Link href="/privacy" className="au-field-link">Privacy Policy</Link>.
              </p>
            )}
          </form>

          {/* Bottom prompt */}
          <div className="au-bottom">
            {mode === 'signin' && (
              <>
                New to Nodea?{' '}
                <button type="button" className="au-field-link" onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                Already have an account?{' '}
                <button type="button" className="au-field-link" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <button type="button" className="au-field-link" onClick={() => switchMode('signin')}>
                &larr; Back to sign in
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// useSearchParams requires a Suspense boundary so the rest of the route can
// still be prerendered (see Next docs: use-search-params).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
