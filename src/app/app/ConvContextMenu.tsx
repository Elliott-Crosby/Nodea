'use client'

// ─── ConvContextMenu — right-click menu for a conversation row ───────────────
// Items: Move to project ▸ (submenu of projects), Remove from project,
// Rename / Edit, Delete.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ProjectIcon, colorById, PROJECT_COLORS } from './projectConstants'
import type { Conversation } from './App'
import type { ChatProject } from './chatProjectTypes'

interface Props {
  x: number
  y: number
  conv: Conversation
  projects: ChatProject[]
  isPro: boolean
  /** Conversation owned by someone else (shared with me): no re-filing, and
   *  "Delete" reads as "Leave" (the App-level delete already only leaves). */
  shared?: boolean
  onMove: (projectId: string) => void
  onRemove: () => void
  onColor: (color: string | null) => void
  onEdit: () => void
  onDelete: () => void
  onShare: () => void
  onUpgradeRequired: () => void
  onClose: () => void
}

const MENU_WIDTH = 210
const SUBMENU_WIDTH = 210

export default function ConvContextMenu({
  x, y, conv, projects, isPro, shared,
  onMove, onRemove, onColor, onEdit, onDelete, onShare, onUpgradeRequired, onClose,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const [submenu, setSubmenu] = useState<'project' | 'color' | null>(null)
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
      {/* Move to project (submenu) — own conversations only; re-filing a
          shared conversation would reorganize the owner's workspace. */}
      {!shared && <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setSubmenu('project')}
        onMouseLeave={() => setSubmenu(null)}
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

        {submenu === 'project' && (
          <div
            style={{
              position: 'absolute',
              top: -5,
              [submenuRight ? 'right' : 'left']: MENU_WIDTH - 14,
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
                  className={current ? 'conv-proj-item conv-proj-item--current' : 'conv-proj-item'}
                  title={current ? 'Click to remove from this project' : undefined}
                  onClick={() => {
                    if (current) { onRemove(); onClose(); return }
                    if (!isPro) { onUpgradeRequired(); return }
                    onMove(p.id)
                    onClose()
                  }}
                  style={{ ...itemStyle, justifyContent: 'space-between' }}
                  onMouseEnter={(e) => hov(e, true)}
                  onMouseLeave={(e) => hov(e, false)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: c.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ProjectIcon name={p.icon} size={12} color={c.hex} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  </span>
                  {current && (
                    <span className="conv-proj-current" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {/* Checkmark by default; swaps to an ✕ on hover to signal "click to remove". */}
                      <svg className="conv-proj-check" width="11" height="11" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5.5l2.2 2.5 4.8-5.5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <svg className="conv-proj-remove" width="11" height="11" viewBox="0 0 10 10" fill="none">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="var(--color-error)" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>}

      {/* Color (submenu) */}
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setSubmenu('color')}
        onMouseLeave={() => setSubmenu(null)}
      >
        <button
          type="button"
          style={{ ...itemStyle, justifyContent: 'space-between' }}
          onMouseEnter={(e) => hov(e, true)}
          onMouseLeave={(e) => hov(e, false)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                background: conv.color ? colorById(conv.color).hex : 'transparent',
                border: conv.color ? 'none' : '1.6px solid var(--text-muted)',
              }}
            />
            Color
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
            <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {submenu === 'color' && (
          <div
            style={{
              position: 'absolute',
              top: -5,
              [submenuRight ? 'right' : 'left']: MENU_WIDTH - 14,
              width: 168,
              background: 'var(--modal-bg)',
              border: '1px solid var(--border)',
              borderRadius: 11,
              boxShadow: 'var(--shadow-lg)',
              padding: 10,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              <button
                type="button"
                title="No color"
                onClick={() => { onColor(null); onClose() }}
                style={{
                  width: 24, height: 24, borderRadius: '50%', padding: 0, cursor: 'pointer',
                  background: 'transparent',
                  border: !conv.color ? '2.5px solid var(--text-primary)' : '1.5px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 11L11 2" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
              {PROJECT_COLORS.map((p) => {
                const active = conv.color === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.label}
                    onClick={() => { onColor(p.id); onClose() }}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', padding: 0, cursor: 'pointer',
                      background: p.hex,
                      border: active ? '2.5px solid var(--text-primary)' : `1.5px solid ${p.hex}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: active ? `0 0 0 2px var(--modal-bg), 0 0 0 4px ${p.hex}` : 'none',
                    }}
                  >
                    {active && (
                      <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.2 2.5L8 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {inProject && !shared && (
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

      <button
        type="button"
        style={itemStyle}
        onMouseEnter={(e) => hov(e, true)}
        onMouseLeave={(e) => hov(e, false)}
        onClick={() => { onShare(); onClose() }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 10.7l6.8-3.9M8.6 13.3l6.8 3.9" />
        </svg>
        Share
      </button>

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
        {shared ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" />
          </svg>
        )}
        {shared ? 'Leave shared chat' : 'Delete'}
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
