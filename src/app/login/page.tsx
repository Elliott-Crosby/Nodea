'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

type Mode = 'signin' | 'signup' | 'forgot'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email to confirm your account.')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login/update-password`,
        })
        if (error) throw error
        setMessage('Password reset link sent — check your email.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/app'
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const subtitle =
    mode === 'signup' ? 'Create your account' :
    mode === 'forgot' ? 'Reset your password' :
    'Sign in to your account'

  const submitLabel =
    loading ? 'Loading…' :
    mode === 'signup' ? 'Create account' :
    mode === 'forgot' ? 'Send reset link' :
    'Sign in'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '360px', padding: '0 16px' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--accent)', margin: 0, letterSpacing: '-0.5px' }}>
            Nodea
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
            {subtitle}
          </p>
        </div>

        <div
          style={{
            background: 'var(--modal-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Password — hidden in forgot mode */}
            {mode !== 'forgot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--accent-text)', cursor: 'pointer', padding: 0 }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ padding: '9px 12px', borderRadius: '8px', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', fontSize: '13px', color: 'var(--color-error)' }}>
                {error}
              </div>
            )}

            {/* Success */}
            {message && (
              <div style={{ padding: '9px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '13px', color: '#15803d' }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '10px', fontSize: '13px', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1, width: '100%', transition: 'opacity 0.15s',
              }}
            >
              {submitLabel}
            </button>
          </form>

          {/* Bottom links */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            {mode === 'forgot' ? (
              <button onClick={() => switchMode('signin')} style={linkStyle}>
                Back to sign in
              </button>
            ) : (
              <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} style={linkStyle}>
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            )}
          </div>
        </div>

        {/* Guest */}
        {mode !== 'forgot' && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              onClick={async () => {
                setError(null)
                setLoading(true)
                const { error } = await supabase.auth.signInAnonymously()
                if (error) { setError(error.message); setLoading(false) }
                else window.location.href = '/app'
              }}
              disabled={loading}
              style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--text-muted)', cursor: loading ? 'not-allowed' : 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--border)' }}
            >
              Continue as guest
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '13px',
  color: 'var(--text-muted)',
  cursor: 'pointer',
}
