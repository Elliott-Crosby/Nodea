'use client'

// ─── ProjectModal — create or edit a chat project ────────────────────────────
// Used in two modes:
//   editing === null  → create flow
//   editing === {...} → prefill from the existing project
//
// Saving is owned by the parent (App.tsx) so it can fold the result back into
// its in-memory list. The modal just collects the form values.

import { useState, useEffect } from 'react'
import {
  PROJECT_COLORS,
  ICON_KEYS,
  ProjectIcon,
  colorById,
  DEFAULT_ICON,
  DEFAULT_COLOR_ID,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from './projectConstants'
import type { ChatProject } from './chatProjectTypes'

interface Props {
  editing: ChatProject | null
  onClose: () => void
  onSave: (data: {
    name: string
    description: string
    icon: string
    color: string
  }) => Promise<void> | void
}

export default function ProjectModal({ editing, onClose, onSave }: Props) {
  const [name, setName]         = useState(editing?.name ?? '')
  const [desc, setDesc]         = useState(editing?.description ?? '')
  const [icon, setIcon]         = useState(editing?.icon ?? DEFAULT_ICON)
  const [color, setColor]       = useState(editing?.color ?? DEFAULT_COLOR_ID)
  const [saving, setSaving]     = useState(false)
  const c = colorById(color)
  const isEdit = !!editing

  // Cmd/Ctrl+Enter to save, Escape to close — both feel native here.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        attemptSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, desc, icon, color])

  async function attemptSave() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await onSave({
        name: trimmed,
        description: desc.trim(),
        icon,
        color,
      })
    } finally {
      setSaving(false)
    }
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
          width: 440, maxWidth: '100%',
          background: 'var(--modal-bg)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          padding: '26px 28px',
          animation: 'upgradeIn 0.22s cubic-bezier(0.34,1.4,0.64,1)',
        }}
      >
        {/* ── Header (live preview of icon/color) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 11,
              background: c.soft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <ProjectIcon name={icon} size={20} color={c.hex} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {isEdit ? 'Edit project' : 'New project'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Organize related conversations together.
            </p>
          </div>
        </div>

        {/* ── Name ── */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>NAME</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            placeholder="e.g. Thesis Research"
            style={inputStyle}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); attemptSave() } }}
          />
        </div>

        {/* ── Description ── */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>
            DESCRIPTION{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· optional</span>
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
            rows={2}
            placeholder="What's this project about?"
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
          />
        </div>

        {/* ── Icon ── */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>ICON</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
            {ICON_KEYS.map((k) => {
              const selected = k === icon
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIcon(k)}
                  title={k}
                  style={{
                    aspectRatio: '1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 9, cursor: 'pointer',
                    background: selected ? c.soft : 'var(--bg-subtle)',
                    border: selected ? `1.5px solid ${c.hex}` : '1.5px solid transparent',
                    color: selected ? c.hex : 'var(--text-secondary)',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)' }}
                  onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' }}
                >
                  <ProjectIcon name={k} size={18} />
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Color ── */}
        <div>
          <label style={labelStyle}>COLOR</label>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {PROJECT_COLORS.map((cc) => {
              const sel = cc.id === color
              return (
                <button
                  key={cc.id}
                  type="button"
                  onClick={() => setColor(cc.id)}
                  title={cc.label}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: cc.hex,
                    cursor: 'pointer',
                    border: '2px solid var(--modal-bg)',
                    boxShadow: sel ? `0 0 0 2px ${cc.hex}` : '0 0 0 1px var(--border)',
                    transition: 'transform 0.1s',
                    transform: sel ? 'scale(1.08)' : 'scale(1)',
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '9px 16px',
              borderRadius: 9,
              fontSize: 13, fontWeight: 500,
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
              padding: '9px 18px',
              borderRadius: 9,
              fontSize: 13, fontWeight: 600,
              border: 'none',
              background: name.trim() && !saving ? 'var(--accent)' : 'var(--bg-muted)',
              color: name.trim() && !saving ? '#fff' : 'var(--text-muted)',
              cursor: name.trim() && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create project')}
          </button>
        </div>

        <CloseBtn onClick={onClose} />
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

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 9,
  fontSize: 13.5,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
} as const

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close"
      style={{
        position: 'absolute',
        top: 14, right: 14,
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-muted)',
        border: '1px solid var(--border)',
        borderRadius: 7,
        cursor: 'pointer',
        color: 'var(--text-muted)',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)')}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}
