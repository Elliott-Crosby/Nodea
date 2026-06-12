'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from './App'

// ─── ShareModal ──────────────────────────────────────────────────────────────
// One modal for both share targets: a single conversation or a whole Chat
// Project (the team space). Shows the member list, pending invites, an
// email-invite composer, and a copy-link button. Invite delivery is the
// owner's channel of choice (copied link / prefilled email) — no SMTP
// dependency in v1.

interface Member {
  user_id: string
  role: 'owner' | 'editor'
  display_name: string
  email: string | null
}

interface PendingInvite {
  id: string
  token: string
  email: string | null
  created_at: string
  expires_at: string
}

interface ShareModalProps {
  target: { kind: 'conversation' | 'chat_project'; id: string; name: string }
  onClose: () => void
  /** Fired after a membership-affecting action (remove member, revoke). */
  onMembershipChanged: () => void
}

const AVATAR_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6']
export function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function ShareModal({ target, onClose, onMembershipChanged }: ShareModalProps) {
  const { myUserId } = useApp()
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const targetQuery = target.kind === 'conversation'
    ? `conversationId=${target.id}`
    : `chatProjectId=${target.id}`

  const flash = useCallback((msg: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(msg)
    noticeTimer.current = setTimeout(() => setNotice(null), 2600)
  }, [])
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/collab/members?${targetQuery}`)
      if (!res.ok) { setError('Could not load members.'); return }
      const data = await res.json() as { members: Member[]; invites: PendingInvite[] }
      setMembers(data.members ?? [])
      setInvites(data.invites ?? [])
      setError(null)
    } catch {
      setError('Could not load members.')
    } finally {
      setLoading(false)
    }
  }, [targetQuery])

  useEffect(() => { void reload() }, [reload])

  // Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isOwner = members.find((m) => m.role === 'owner')?.user_id === myUserId

  const createInvite = useCallback(async (boundEmail: string | null): Promise<string | null> => {
    const res = await fetch('/api/collab/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: target.kind,
        conversationId: target.kind === 'conversation' ? target.id : undefined,
        chatProjectId: target.kind === 'chat_project' ? target.id : undefined,
        email: boundEmail ?? undefined,
      }),
    })
    const data = await res.json().catch(() => ({})) as { joinUrl?: string; error?: string }
    if (!res.ok || !data.joinUrl) {
      setError(data.error === 'forbidden' ? 'You don’t have access to share this.' : 'Could not create the invite.')
      return null
    }
    return data.joinUrl
  }, [target])

  // Copy a general (email-unbound, multi-use) link. Reuses a pending link
  // invite when one exists so the modal doesn't mint a pile of tokens.
  const copyLink = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const existing = invites.find((i) => !i.email)
      const url = existing
        ? `${window.location.origin}/join/${existing.token}`
        : await createInvite(null)
      if (!url) return
      await navigator.clipboard.writeText(url)
      flash('Link copied — anyone who opens it joins as an editor.')
      if (!existing) void reload()
    } catch {
      setError('Could not copy the link.')
    } finally {
      setBusy(false)
    }
  }, [invites, createInvite, flash, reload])

  const sendEmailInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/.+@.+\..+/.test(addr)) { setError('Enter a valid email address.'); return }
    setBusy(true)
    setError(null)
    try {
      const url = await createInvite(addr)
      if (!url) return
      setEmail('')
      await navigator.clipboard.writeText(url).catch(() => {})
      // Hand off to the user's own mail client with everything prefilled.
      const subject = encodeURIComponent(`Join "${target.name}" on Nodea`)
      const body = encodeURIComponent(
        `I'm sharing "${target.name}" with you on Nodea — open this link to join:\n\n${url}\n\n` +
        `Sign in (or create a free account) with this email address and it'll appear in your sidebar.`,
      )
      window.open(`mailto:${addr}?subject=${subject}&body=${body}`, '_self')
      flash(`Invite for ${addr} created — link copied & email drafted.`)
      void reload()
    } finally {
      setBusy(false)
    }
  }, [email, createInvite, target.name, flash, reload])

  const revokeInvite = useCallback(async (id: string) => {
    await fetch(`/api/collab/invites?id=${id}`, { method: 'DELETE' }).catch(() => {})
    void reload()
  }, [reload])

  const removeMember = useCallback(async (userId: string) => {
    const q = target.kind === 'conversation'
      ? `conversationId=${target.id}&userId=${userId}`
      : `chatProjectId=${target.id}&userId=${userId}`
    await fetch(`/api/collab/members?${q}`, { method: 'DELETE' }).catch(() => {})
    onMembershipChanged()
    void reload()
  }, [target, onMembershipChanged, reload])

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${target.name}`}
        style={{
          width: 440, maxWidth: '100%', maxHeight: '82vh', overflowY: 'auto',
          background: 'var(--modal-bg)', color: 'var(--text-primary)',
          border: '1px solid var(--border-strong)', borderRadius: 14,
          boxShadow: 'var(--shadow-lg)', padding: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>
              Share {target.kind === 'chat_project' ? 'project' : 'chat'}
            </h2>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 330 }}>
              {target.name}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0, borderRadius: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {target.kind === 'chat_project' && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
            Members can open every chat in this project, reply, and branch. Each
            person&rsquo;s AI usage counts against their own plan.
          </p>
        )}
        {target.kind === 'conversation' && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
            Members can read this chat, reply, and branch. Each person&rsquo;s AI
            usage counts against their own plan.
          </p>
        )}

        {/* Email invite */}
        <form onSubmit={sendEmailInvite} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@email.com"
            style={{
              flex: 1, padding: '8px 11px', borderRadius: 8,
              border: '1.5px solid var(--border)', background: 'var(--input-bg)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: busy || !email.trim() ? 'default' : 'pointer',
              opacity: busy || !email.trim() ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            Invite
          </button>
        </form>

        {/* Copy link */}
        <button
          type="button"
          onClick={() => void copyLink()}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 11px', marginBottom: 14,
            background: 'transparent', border: '1.5px dashed var(--border-strong)', borderRadius: 8,
            cursor: busy ? 'default' : 'pointer', color: 'var(--text-secondary)',
            fontSize: 12.5, fontWeight: 600,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
          </svg>
          Copy invite link
          <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>
            anyone with the link
          </span>
        </button>

        {(notice || error) && (
          <div
            role="status"
            style={{
              fontSize: 12, padding: '7px 10px', borderRadius: 7, marginBottom: 12,
              background: error ? 'var(--color-error-bg, rgba(239,68,68,0.12))' : 'var(--accent-bg)',
              color: error ? 'var(--color-error, #ef4444)' : 'var(--accent-text)',
            }}
          >
            {error ?? notice}
          </div>
        )}

        {/* Members */}
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '4px 0 6px' }}>
          Members
        </div>
        {loading ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '6px 0 10px' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: invites.length ? 12 : 0 }}>
            {members.map((m) => (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: avatarColor(m.user_id), color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11.5, fontWeight: 700,
                }}>
                  {m.display_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.display_name}{m.user_id === myUserId ? ' (you)' : ''}
                  </div>
                  {m.email && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.email}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {m.role}
                </span>
                {((isOwner && m.role !== 'owner') || (m.user_id === myUserId && m.role !== 'owner')) && (
                  <button
                    type="button"
                    title={m.user_id === myUserId ? 'Leave' : 'Remove member'}
                    onClick={() => void removeMember(m.user_id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, lineHeight: 0, borderRadius: 5 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pending invites */}
        {invites.length > 0 && (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '4px 0 6px' }}>
              Pending invites
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {invites.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 2px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    {inv.email
                      ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>
                      : <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>}
                  </svg>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inv.email ?? 'Invite link'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(`${window.location.origin}/join/${inv.token}`)
                        .then(() => flash('Invite link copied.'))
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 600, padding: '2px 4px' }}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => void revokeInvite(inv.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-error, #ef4444)', fontSize: 11.5, fontWeight: 600, padding: '2px 4px' }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
