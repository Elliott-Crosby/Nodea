'use client'

// ─── ConvContextMenu — right-click menu for a conversation row ───────────────
// Items: Move to project ▸ (submenu of projects), Remove from project,
// Rename / Edit, Delete.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ProjectIcon, colorById } from './projectConstants'
import type { Conversation } from './App'
import type { ChatProject } from './chatProjectTypes'

interface Props {
  x: number
  y: number
  conv: Conversation
  projects: ChatProject[]
  isPro: boolean
  onMove: (projectId: string) => void
  onRemove: () => void
  onEdit: () => void
  onDelete: () => void
  onUpgradeRequired: () => void
  onClose: () => void
}

const MENU_WIDTH = 210
const SUBMENU_WIDTH = 210

export default function ConvContextMenu({
  x, y, conv, projects, isPro,
  onMove, onRemove, onEdit, onDelete, onUpgradeRequired, onClose,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const [submenu, setSubmenu] = useState(false)
  const [pos, setPos] = useState({ x, y })

  // Ref callback that fires on attach — measures the DOM and clamps the menu
  // inside the viewport. This pattern keeps the position update out of an
  // effect body (React Hooks lint rule `react-hooks/set-state-in-effect`).
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el
    if (!el) return
    const r = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (x + r.width  > window.innerWidth  - 8) nx = window.innerWidth  - r.width  - 8
    if (y + r.height > window.innerHeight - 8) ny = window.innerHeight - r.height - 8
    if (nx !== x || ny !== y) setPos({ x: nx, y: ny })
  }, [x, y])

  // Outside click + Esc closes.
  useEffect(() => {
    function close(e: MouseEvent) {
      if (elRef.current && !elRef.current.contains(e.target as Node)) onClose()
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  const inProject = !!conv.chat_project_id
  const submenuRight = pos.x + MENU_WIDTH + SUBMENU_WIDTH > window.innerWidth

  return (
    <div
      ref={measureRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: pos.x, top: pos.y, zIndex: 1200, width: MENU_WIDTH,
        background: 'var(--modal-bg)',
        border: '1px solid var(--border)',
        borderRadius: 11,
        boxShadow: 'var(--shadow-lg)',
        padding: 5,
      }}
    >
      {/* Move to project (submenu) */}
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setSubmenu(true)}
        onMouseLeave={() => setSubmenu(false)}
      >
        <button
          type="button"
          style={{ ...itemStyle, justifyContent: 'space-between' }}
          onMouseEnter={(e) => hov(e, true)}
          onMouseLeave={(e) => hov(e, false)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            Move to project
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
            <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {submenu && (
          <div
            style={{
              position: 'absolute',
              top: -5,
              [submenuRight ? 'right' : 'left']: MENU_WIDTH - 4,
              width: SUBMENU_WIDTH,
              background: 'var(--modal-bg)',
              border: '1px solid var(--border)',
              borderRadius: 11,
              boxShadow: 'var(--shadow-lg)',
              padding: 5,
              maxHeight: 280, overflowY: 'auto',
            }}
          >
            {projects.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                No projects yet.
              </div>
            ) : projects.map((p) => {
              const c = colorById(p.color)
              const current = conv.chat_project_id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={current}
                  onClick={() => {
                    if (current) return
                    if (!isPro) { onUpgradeRequired(); return }
                    onMove(p.id)
                    onClose()
                  }}
                  style={{
                    ...itemStyle,
                    opacity: current ? 0.5 : 1,
                    cursor: current ? 'default' : 'pointer',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => { if (!current) hov(e, true) }}
                  onMouseLeave={(e) => hov(e, false)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: c.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ProjectIcon name={p.icon} size={12} color={c.hex} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  </span>
                  {current && (
                    <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5.5l2.2 2.5 4.8-5.5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {inProject && (
        <button
          type="button"
          style={itemStyle}
          onMouseEnter={(e) => hov(e, true)}
          onMouseLeave={(e) => hov(e, false)}
          onClick={() => { onRemove(); onClose() }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <path d="M9 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-4" />
            <path d="M12 3v10M9 6l3-3 3 3" />
          </svg>
          Remove from project
        </button>
      )}

      <div style={{ height: 1, background: 'var(--border)', margin: '5px 8px' }} />

      <button
        type="button"
        style={itemStyle}
        onMouseEnter={(e) => hov(e, true)}
        onMouseLeave={(e) => hov(e, false)}
        onClick={() => { onEdit(); onClose() }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <path d="M4 20h4l10-10-4-4L4 16z" />
          <path d="M13.5 6.5l4 4" />
        </svg>
        Rename &amp; edit
      </button>
      <button
        type="button"
        style={{ ...itemStyle, color: 'var(--color-error)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-bg)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        onClick={() => { onDelete(); onClose() }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" />
        </svg>
        Delete
      </button>
    </div>
  )
}

const itemStyle = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '8px 12px', fontSize: 13,
  color: 'var(--text-secondary)',
  background: 'transparent', border: 'none',
  cursor: 'pointer', textAlign: 'left' as const,
  borderRadius: 7, whiteSpace: 'nowrap' as const,
}

function hov(e: React.MouseEvent<HTMLButtonElement>, on: boolean) {
  e.currentTarget.style.background = on ? 'var(--bg-subtle)' : 'transparent'
}
