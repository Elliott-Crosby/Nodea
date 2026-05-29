'use client'

// ─── DeleteProjectModal — confirm deletion with two options ──────────────────
// The default is "keep conversations" (just unparent them). The second option
// also deletes every conversation in this project.

import { useState, useEffect } from 'react'
import { ProjectIcon, colorById } from './projectConstants'
import type { ChatProject } from './chatProjectTypes'

interface Props {
  project: ChatProject
  onClose: () => void
  onConfirm: (deleteConversations: boolean) => Promise<void> | void
}

export default function DeleteProjectModal({ project, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<'keep' | 'all'>('keep')
  const [working, setWorking] = useState(false)
  const c = colorById(project.color)
  const count = project.chat_count

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !working) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, working])

  async function confirm() {
    if (working) return
    setWorking(true)
    try {
      await onConfirm(mode === 'all')
    } finally {
      setWorking(false)
    }
  }

  const options = [
    {
      id: 'keep' as const,
      title: 'Move conversations out',
      desc: count > 0
        ? `${count} conversation${count === 1 ? '' : 's'} stay in your library, just untagged.`
        : 'There are no conversations to keep.',
    },
    {
      id: 'all' as const,
      title: 'Delete conversations too',
      desc: count > 0
        ? `Permanently removes the project and its ${count} conversation${count === 1 ? '' : 's'}.`
        : 'Permanently removes the project.',
    },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--modal-overlay)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '100%',
          background: 'var(--modal-bg)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          padding: '26px 28px',
          animation: 'upgradeIn 0.22s cubic-bezier(0.34,1.4,0.64,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 11,
              background: c.soft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ProjectIcon name={project.icon} size={20} color={c.hex} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Delete &ldquo;{project.name}&rdquo;?
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px' }}>
          Choose what happens to the conversations in this project.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {options.map((o) => {
            const sel = mode === o.id
            const danger = o.id === 'all'
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setMode(o.id)}
                style={{
                  display: 'flex', gap: 11, alignItems: 'flex-start',
                  textAlign: 'left', width: '100%',
                  padding: '13px 14px', borderRadius: 11, cursor: 'pointer',
                  background: sel
                    ? (danger ? 'var(--color-error-bg)' : 'var(--accent-bg)')
                    : 'var(--bg-subtle)',
                  border: sel
                    ? `1.5px solid ${danger ? 'var(--color-error)' : 'var(--accent)'}`
                    : '1.5px solid transparent',
                  transition: 'all 0.1s',
                }}
              >
                <span
                  style={{
                    width: 16, height: 16, borderRadius: '50%',
                    flexShrink: 0, marginTop: 1,
                    border: `1.5px solid ${sel ? (danger ? 'var(--color-error)' : 'var(--accent)') : 'var(--border-strong)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {sel && (
                    <span
                      style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: danger ? 'var(--color-error)' : 'var(--accent)',
                      }}
                    />
                  )}
                </span>
                <span>
                  <span
                    style={{
                      display: 'block', fontSize: 13, fontWeight: 600,
                      color: 'var(--text-primary)', marginBottom: 2,
                    }}
                  >
                    {o.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {o.desc}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 22 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            style={{
              padding: '9px 16px', borderRadius: 9,
              fontSize: 13, fontWeight: 500,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: working ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={working}
            style={{
              padding: '9px 18px', borderRadius: 9,
              fontSize: 13, fontWeight: 600,
              border: 'none',
              background: 'var(--color-error)',
              color: '#fff',
              cursor: working ? 'not-allowed' : 'pointer',
              opacity: working ? 0.75 : 1,
            }}
          >
            {working ? 'Deleting…' : (mode === 'all' ? 'Delete everything' : 'Delete project')}
          </button>
        </div>
      </div>
    </div>
  )
}
