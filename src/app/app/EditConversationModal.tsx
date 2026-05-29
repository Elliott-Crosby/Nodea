'use client'

// ─── EditConversationModal — rename + reassign project in one place ──────────
// Opens from the conversation context menu ("Rename & edit"). Combines the
// rename input with a project picker (No project + every project as a chip)
// so the user can do both without two menu jumps.

import { useState, useEffect } from 'react'
import { ProjectIcon, colorById } from './projectConstants'
import type { Conversation } from './App'
import type { ChatProject } from './chatProjectTypes'

interface Props {
  conv: Conversation
  projects: ChatProject[]
  isPro: boolean
  onClose: () => void
  onSave: (changes: { name: string; chat_project_id: string | null }) => Promise<void> | void
  onUpgradeRequired: () => void
}

export default function EditConversationModal({
  conv, projects, isPro, onClose, onSave, onUpgradeRequired,
}: Props) {
  const [name, setName] = useState(conv.name)
  const [projectId, setProjectId] = useState<string | null>(conv.chat_project_id ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  async function attemptSave() {
    if (saving) return
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onSave({ name: trimmed, chat_project_id: projectId })
    } finally {
      setSaving(false)
    }
  }

  function chooseProject(id: string | null) {
    // Only attaching requires Pro. Detaching is always allowed.
    if (id !== null && !isPro) {
      onUpgradeRequired()
      return
    }
    setProjectId(id)
  }

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
          width: 420, maxWidth: '100%',
          background: 'var(--modal-bg)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
          animation: 'upgradeIn 0.2s ease-out',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18, letterSpacing: '-0.01em' }}>
          Edit conversation
        </h3>

        <label style={labelStyle}>NAME</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); attemptSave() } }}
          style={{
            width: '100%',
            padding: '9px 11px',
            borderRadius: 9,
            fontSize: 13.5,
            border: '1.5px solid var(--accent)',
            background: 'var(--input-bg)',
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'inherit',
            marginBottom: 18,
          }}
        />

        <label style={labelStyle}>PROJECT</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 132, overflowY: 'auto', paddingRight: 2 }}>
          <ChipButton
            active={projectId === null}
            color={null}
            onClick={() => chooseProject(null)}
            label="No project"
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5l14 14M19 5L5 19" opacity="0.6" />
              </svg>
            }
          />
          {projects.map((p) => {
            const c = colorById(p.color)
            return (
              <ChipButton
                key={p.id}
                active={projectId === p.id}
                color={c.hex}
                soft={c.soft}
                onClick={() => chooseProject(p.id)}
                label={p.name}
                icon={<ProjectIcon name={p.icon} size={15} color={c.hex} strokeWidth={1.8} style={{ flexShrink: 0 }} />}
              />
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 22 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 15px',
              borderRadius: 9,
              fontSize: 13,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={attemptSave}
            disabled={!name.trim() || saving}
            style={{
              padding: '8px 16px',
              borderRadius: 9,
              fontSize: 13, fontWeight: 600,
              border: 'none',
              background: name.trim() && !saving ? 'var(--accent)' : 'var(--bg-muted)',
              color: name.trim() && !saving ? '#fff' : 'var(--text-muted)',
              cursor: name.trim() && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 11.5, fontWeight: 600,
  color: 'var(--text-secondary)',
  letterSpacing: '0.02em',
  marginBottom: 8, display: 'block',
} as const

interface ChipButtonProps {
  active: boolean
  color: string | null
  soft?: string
  onClick: () => void
  label: string
  icon: React.ReactNode
}

function ChipButton({ active, color, soft, onClick, label, icon }: ChipButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 11px 7px 9px',
        borderRadius: 9,
        cursor: 'pointer',
        fontSize: 12.5, fontWeight: 500,
        textAlign: 'left',
        background: active
          ? (soft ?? 'var(--accent-bg)')
          : 'var(--bg-subtle)',
        border: active
          ? `1.5px solid ${color ?? 'var(--accent)'}`
          : '1.5px solid transparent',
        color: active
          ? (color ?? 'var(--accent-text)')
          : 'var(--text-secondary)',
        transition: 'all 0.1s',
      }}
    >
      <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      {label}
    </button>
  )
}
