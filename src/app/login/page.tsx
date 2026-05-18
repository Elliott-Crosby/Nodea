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

  const subtitle = 'Think in branches.'

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
        padding: '36px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '460px' }}>

        {/* Heading */}
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '68px', fontWeight: 500, color: 'var(--accent)', margin: '0 0 12px', letterSpacing: '-2px', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            Nodea
          </h1>
          <p style={{ fontSize: '22px', color: 'var(--text-muted)', margin: 0 }}>
            {subtitle}
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--modal-bg)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '36px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Email
              </label>
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

            {/* Password */}
            {mode !== 'forgot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      style={{ background: 'none', border: 'none', fontSize: '14px', color: 'var(--accent-text)', cursor: 'pointer', padding: 0 }}
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
              <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', fontSize: '15px', color: 'var(--color-error)' }}>
                {error}
              </div>
            )}

            {/* Success */}
            {message && (
              <div style={{ padding: '14px 18px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '15px', color: '#15803d' }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '15px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                width: '100%',
                transition: 'opacity 0.15s',
                marginTop: '2px',
              }}
            >
              {submitLabel}
            </button>
          </form>

          {/* Bottom link */}
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
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
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '14px 18px',
  fontSize: '16px',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '15px',
  color: 'var(--text-muted)',
  cursor: 'pointer',
}
