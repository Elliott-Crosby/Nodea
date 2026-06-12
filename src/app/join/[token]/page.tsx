'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { PENDING_JOIN_KEY } from '@/lib/collab-client'

// ─── /join/[token] — open an invite link ─────────────────────────────────────
// Signed in → accept immediately (mints the membership) and land inside the
// shared space. Signed out → park the token in localStorage and bounce to
// /login; the app shell replays it after auth (see PENDING_JOIN_KEY in App).
// This survives the /welcome detour new signups take, because the replay
// happens on /app, not here.

const ERROR_COPY: Record<string, string> = {
  invite_not_found: 'This invite link is invalid — it may have been revoked.',
  invite_expired: 'This invite link has expired. Ask for a fresh one.',
  invite_email_mismatch:
    'This invite was sent to a different email address. Sign in with the invited account to join.',
  space_gone: 'The shared space behind this invite no longer exists.',
}

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [status, setStatus] = useState<'working' | 'error'>('working')
  const [message, setMessage] = useState('Checking your invite…')
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return  // Strict Mode double-effect guard
    ranRef.current = true

    async function run() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        try { localStorage.setItem(PENDING_JOIN_KEY, token) } catch {}
        router.replace('/login')
        return
      }

      const res = await fetch('/api/collab/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({})) as {
        ok?: boolean; kind?: string; id?: string; error?: string
      }

      if (!res.ok || !data.ok || !data.id) {
        setStatus('error')
        setMessage(ERROR_COPY[data.error ?? ''] ?? 'Something went wrong opening this invite.')
        return
      }

      setMessage('You’re in — opening the shared space…')
      const dest = data.kind === 'chat_project'
        ? `/app?project=${data.id}`
        : `/app?conv=${data.id}`
      router.replace(dest)
    }
    void run()
  }, [token, router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base, #0d0d10)', color: 'var(--text-primary, #e7e7ea)',
      fontFamily: 'system-ui, sans-serif', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6', marginBottom: 14 }}>Nodea</div>
        {status === 'working' && (
          <div aria-hidden style={{
            width: 22, height: 22, margin: '0 auto 14px', borderRadius: '50%',
            border: '2.5px solid rgba(139,92,246,0.25)', borderTopColor: '#8b5cf6',
            animation: 'nodea-join-spin 0.8s linear infinite',
          }} />
        )}
        <p style={{ fontSize: 15, lineHeight: 1.5 }}>{message}</p>
        {status === 'error' && (
          <a href="/app" style={{ display: 'inline-block', marginTop: 16, color: '#8b5cf6', fontWeight: 600, fontSize: 14 }}>
            Go to your canvas →
          </a>
        )}
        <style>{'@keyframes nodea-join-spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    </div>
  )
}
