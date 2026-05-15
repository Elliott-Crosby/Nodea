'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useApp, computeLayout, truncate, DbNode } from './App'

const NODE_W = 172
const NODE_H = 56

const PALETTE = [
  { id: 'default', label: 'Default', hex: ''        },
  { id: 'violet',  label: 'Violet',  hex: '#8b5cf6' },
  { id: 'blue',    label: 'Blue',    hex: '#3b82f6' },
  { id: 'green',   label: 'Green',   hex: '#22c55e' },
  { id: 'red',     label: 'Red',     hex: '#ef4444' },
  { id: 'orange',  label: 'Orange',  hex: '#f97316' },
]

export default function TreePanel() {
  const { allDbNodes, selectedNodeId, handleNodeClick, nodeColors, setNodeColor, chatInputRef } = useApp()

  const [collapsed, setCollapsed]   = useState(false)
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [colorMenu, setColorMenu]   = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [scale, setScale]           = useState(1)

  const containerRef = useRef<HTMLDivElement>(null)

  const positions = useMemo(() => computeLayout(allDbNodes, 200, 90), [allDbNodes])

  const edges = useMemo(
    () => allDbNodes.filter((n) => n.parent_id && positions.has(n.id) && positions.has(n.parent_id!)),
    [allDbNodes, positions]
  )

  const { canvasW, canvasH, minX } = useMemo(() => {
    if (positions.size === 0) return { canvasW: 0, canvasH: 0, minX: 0 }
    const xs = Array.from(positions.values()).map((p) => p.x)
    const ys = Array.from(positions.values()).map((p) => p.y)
    const mx = Math.min(...xs)
    return {
      canvasW: Math.max(...xs) - mx + NODE_W + 32,
      canvasH: Math.max(...ys) + NODE_H + 80,
      minX: mx,
    }
  }, [positions])

  const tx = (x: number) => x - minX + 16

  // ── Fit view ──────────────────────────────────────────────────────────────
  const fitView = useCallback(() => {
    if (!containerRef.current || canvasW === 0) return
    const pad = 40
    const cw = containerRef.current.clientWidth  - pad
    const ch = containerRef.current.clientHeight - pad
    const sx = cw / canvasW
    const sy = ch / canvasH
    setScale(Math.min(Math.max(sx, sy, 0.35), 1.2))
    containerRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }, [canvasW, canvasH])

  // Auto fit when node count changes
  useEffect(() => {
    if (positions.size > 0) {
      // Small delay so the DOM has rendered
      const t = setTimeout(fitView, 60)
      return () => clearTimeout(t)
    }
  }, [positions.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close color menu on outside click
  useEffect(() => {
    if (!colorMenu) return
    function close() { setColorMenu(null) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [colorMenu])

  // ── Edge rendering ────────────────────────────────────────────────────────
  function renderEdge(node: DbNode) {
    const src = positions.get(node.parent_id!)!
    const tgt = positions.get(node.id)!
    const x1 = tx(src.x) + NODE_W / 2
    const y1 = src.y + NODE_H
    const x2 = tx(tgt.x) + NODE_W / 2
    const y2 = tgt.y
    const isStraight = Math.abs(x1 - x2) < 2
    if (isStraight) {
      return (
        <line key={`e-${node.id}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
      )
    }
    const cy = y1 + (y2 - y1) * 0.5
    return (
      <path key={`e-${node.id}`} d={`M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`}
        stroke="var(--edge-color)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" strokeLinecap="round" />
    )
  }

  // ── Collapsed strip ───────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        style={{
          width: 48, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          borderLeft: '1px solid var(--border)', background: 'var(--tree-bg)',
          height: '100vh',
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Expand button */}
        <button
          onClick={() => setCollapsed(false)}
          title="Expand tree"
          style={{
            marginTop: 12, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-subtle)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2L0 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 2L4 7l9 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
          </svg>
        </button>

        {/* Tree icon */}
        <div style={{ marginTop: 16, opacity: 0.25 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="6" y="1" width="6" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <rect x="1" y="13" width="5" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <rect x="12" y="13" width="5" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9" y1="5" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9" y1="9" x2="3.5" y2="13" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9" y1="9" x2="14.5" y2="13" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
      </div>
    )
  }

  // ── Full panel ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: 284, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--border)', background: 'var(--tree-bg)',
        height: '100vh', position: 'relative',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 12px 0 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--topbar-bg)',
          gap: 6,
        }}
      >
        {/* Collapse button (left) */}
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse tree"
          style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none',
            borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0,
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
          </svg>
        </button>

        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          Tree Diagram
        </span>

        <span style={{
          fontSize: 11, background: 'var(--bg-muted)',
          color: 'var(--text-muted)', borderRadius: 10, padding: '1px 7px', flexShrink: 0,
        }}>
          {allDbNodes.length}
        </span>
      </div>

      {/* ── Tree canvas (scrollable) ─────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'auto', position: 'relative' }}
      >
        {allDbNodes.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-muted)', fontSize: 12,
            textAlign: 'center', padding: 20,
          }}>
            Nodes will appear<br />as you chat
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              width: Math.max(canvasW, 252) * scale,
              height: canvasH * scale,
              transformOrigin: 'top left',
            }}
          >
            {/* Inner scaled canvas */}
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: Math.max(canvasW, 252), height: canvasH }}>
              {/* SVG edges */}
              <svg
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
                width={Math.max(canvasW, 252)} height={canvasH}
              >
                {edges.map((node) => renderEdge(node))}
              </svg>

              {/* Nodes */}
              {allDbNodes.map((node) => {
                const pos = positions.get(node.id)
                if (!pos) return null

                const isActive   = node.id === selectedNodeId
                const isHovered  = node.id === hoveredId
                const isUser     = node.role === 'user'
                const color      = nodeColors[node.id]

                const borderColor = color
                  ? color
                  : isActive ? 'var(--node-active-border)' : isHovered ? 'var(--border-strong)' : 'var(--node-border)'

                const bgColor = color
                  ? `${color}18`
                  : isActive ? 'var(--node-active-bg)' : 'var(--node-bg)'

                return (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      position: 'absolute', left: tx(pos.x), top: pos.y,
                      width: NODE_W, height: NODE_H,
                      background: bgColor,
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px',
                      boxShadow: isActive ? `0 0 0 3px ${color || 'var(--accent-bg)'}` : isHovered ? 'var(--shadow-sm)' : 'none',
                      transition: 'border-color 0.12s, box-shadow 0.12s, background 0.12s',
                    }}
                  >
                    {/* Color dot (if colored) */}
                    {color ? (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none"
                        style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                        <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      </svg>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11,
                        color: isActive ? (color || 'var(--accent-text)') : 'var(--text-primary)',
                        fontWeight: isActive ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {truncate(node.content, 26)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 500,
                          color: isUser ? '#3b82f6' : 'var(--accent-text)',
                          textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.8,
                        }}>
                          {isUser ? 'User' : 'AI'}
                        </span>
                        {isActive && (
                          <span style={{
                            fontSize: 9, fontWeight: 600,
                            background: color || 'var(--accent)',
                            color: '#fff', borderRadius: 4, padding: '0 5px',
                          }}>
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ⋯ color menu trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = e.currentTarget.getBoundingClientRect()
                        setColorMenu({ nodeId: node.id, x: r.left - 130, y: r.bottom + 6 })
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '2px 3px', borderRadius: 4, flexShrink: 0,
                        opacity: isHovered ? 1 : 0, transition: 'opacity 0.1s',
                      }}
                      title="Node color"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="2" r="1" fill="currentColor" />
                        <circle cx="6" cy="6" r="1" fill="currentColor" />
                        <circle cx="6" cy="10" r="1" fill="currentColor" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Zoom toolbar (bottom-left, floating over canvas) ─────────────── */}
      {allDbNodes.length > 0 && (
        <div
          style={{
            position: 'absolute', bottom: 68, left: 12,
            display: 'flex', flexDirection: 'column', gap: 4,
            zIndex: 10,
          }}
        >
          {[
            {
              icon: (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ),
              title: 'Zoom in',
              action: () => setScale((s) => Math.min(2, +(s + 0.15).toFixed(2))),
            },
            {
              icon: (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ),
              title: 'Zoom out',
              action: () => setScale((s) => Math.max(0.3, +(s - 0.15).toFixed(2))),
            },
            {
              icon: (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              ),
              title: 'Fit view',
              action: fitView,
            },
          ].map(({ icon, title, action }) => (
            <button
              key={title}
              onClick={action}
              title={title}
              style={{
                width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--modal-bg)', border: '1px solid var(--border)',
                borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--modal-bg)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      {/* ── Branch button (bottom center) ────────────────────────────────── */}
      <div
        style={{
          position: 'absolute', bottom: 16, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => {
            if (chatInputRef?.current) {
              chatInputRef.current.focus()
              chatInputRef.current.scrollIntoView({ behavior: 'smooth' })
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 16px',
            background: 'var(--modal-bg)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            fontSize: 12, fontWeight: 500,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement
            b.style.background = 'var(--accent-bg)'
            b.style.borderColor = 'var(--accent)'
            b.style.color = 'var(--accent-text)'
            b.style.boxShadow = '0 0 0 3px var(--accent-bg), var(--shadow-md)'
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement
            b.style.background = 'var(--modal-bg)'
            b.style.borderColor = 'var(--border)'
            b.style.color = 'var(--text-secondary)'
            b.style.boxShadow = 'var(--shadow-md)'
          }}
        >
          {/* Branch icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="3" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="11" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3" />
            <path d="M3 4.8v4.4M3 4.8c0 0 .5 2.2 4 2.2h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Branch
        </button>
      </div>

      {/* ── Node color picker (portal-like fixed popup) ───────────────────── */}
      {colorMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: colorMenu.x,
            top: colorMenu.y,
            background: 'var(--modal-bg)',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            padding: '10px 12px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 9999,
            minWidth: 140,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Node color
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {PALETTE.map((p) => {
              const isSelected = (nodeColors[colorMenu.nodeId] || '') === p.hex
              return (
                <button
                  key={p.id}
                  title={p.label}
                  onClick={() => {
                    setNodeColor(colorMenu.nodeId, p.hex)
                    setColorMenu(null)
                  }}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: p.hex || 'var(--bg-muted)',
                    border: isSelected ? '2.5px solid var(--text-primary)' : `1.5px solid ${p.hex ? p.hex + '60' : 'var(--border)'}`,
                    cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isSelected ? '0 0 0 2px var(--modal-bg), 0 0 0 4px ' + (p.hex || 'var(--border)') : 'none',
                    transition: 'box-shadow 0.12s, border 0.12s',
                  }}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke={p.hex ? 'white' : 'var(--text-primary)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
