'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useApp, truncate, type DbNode } from './App'

// ── Constants ──────────────────────────────────────────────────────────────────
const PAIR_W    = 178   // card width
const USER_H    = 50    // user section height
const AI_H      = 50    // AI section height
const PAIR_H    = USER_H + 1 + AI_H  // 101 — 1px is the divider
const H_SPACING = 210
const V_SPACING = 150   // top-to-top distance between pairs
const GRID_PX   = 22    // dot grid size

// ── Colour palette ─────────────────────────────────────────────────────────────
const PALETTE = [
  { id: 'default', label: 'Default', hex: ''        },
  { id: 'violet',  label: 'Violet',  hex: '#8b5cf6' },
  { id: 'blue',    label: 'Blue',    hex: '#3b82f6' },
  { id: 'green',   label: 'Green',   hex: '#22c55e' },
  { id: 'red',     label: 'Red',     hex: '#ef4444' },
  { id: 'orange',  label: 'Orange',  hex: '#f97316' },
]

// ── Pair = one user prompt + its AI reply (vertically stacked into one card) ───
interface Pair {
  id:           string       // aiNode.id, or userNode.id when AI hasn't replied yet
  userNode:     DbNode
  aiNode:       DbNode | null
  parentPairId: string | null
}

function buildPairs(dbNodes: DbNode[]): Pair[] {
  const nodeMap = new Map(dbNodes.map(n => [n.id, n]))
  const pairs: Pair[] = []
  const pairedUserIds = new Set<string>()
  const sorted = [...dbNodes].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))

  for (const node of sorted) {
    if (node.role !== 'assistant') continue
    const userParent = node.parent_id ? nodeMap.get(node.parent_id) : null
    if (!userParent || userParent.role !== 'user') continue
    pairedUserIds.add(userParent.id)

    let parentPairId: string | null = null
    const gp = userParent.parent_id ? nodeMap.get(userParent.parent_id) : null
    if (gp?.role === 'assistant') parentPairId = gp.id

    pairs.push({ id: node.id, userNode: userParent, aiNode: node, parentPairId })
  }

  // unpaired user nodes (streaming / no reply yet)
  for (const node of sorted) {
    if (node.role !== 'user' || pairedUserIds.has(node.id)) continue
    let parentPairId: string | null = null
    const parent = node.parent_id ? nodeMap.get(node.parent_id) : null
    if (parent?.role === 'assistant') parentPairId = parent.id
    pairs.push({ id: node.id, userNode: node, aiNode: null, parentPairId })
  }

  return pairs
}

function computePairLayout(pairs: Pair[]): Map<string, { x: number; y: number }> {
  const childrenMap = new Map<string | null, Pair[]>()
  for (const pair of pairs) {
    const k = pair.parentPairId
    if (!childrenMap.has(k)) childrenMap.set(k, [])
    childrenMap.get(k)!.push(pair)
  }
  const positions = new Map<string, { x: number; y: number }>()
  let leafIdx = 0

  function walk(id: string, depth: number): number {
    const children = childrenMap.get(id) ?? []
    if (children.length === 0) {
      const x = leafIdx * H_SPACING
      leafIdx++
      positions.set(id, { x, y: depth * V_SPACING })
      return x
    }
    const xs = children.map(c => walk(c.id, depth + 1))
    const x = (xs[0] + xs[xs.length - 1]) / 2
    positions.set(id, { x, y: depth * V_SPACING })
    return x
  }

  for (const pair of childrenMap.get(null) ?? []) walk(pair.id, 0)
  return positions
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TreePanel() {
  const { allDbNodes, selectedNodeId, handleNodeClick, nodeColors, setNodeColor, chatInputRef } = useApp()

  const [collapsed,    setCollapsed]    = useState(false)
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)
  const [colorMenu,    setColorMenu]    = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [scale,        setScale]        = useState(1)
  const [pan,          setPan]          = useState({ x: 0, y: 0 })
  const [dragging,     setDragging]     = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const dragOrigin   = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  const pairs         = useMemo(() => buildPairs(allDbNodes), [allDbNodes])
  const pairPositions = useMemo(() => computePairLayout(pairs), [pairs])

  const { canvasW, canvasH } = useMemo(() => {
    if (pairPositions.size === 0) return { canvasW: 400, canvasH: 400 }
    const xs = Array.from(pairPositions.values()).map(p => p.x)
    const ys = Array.from(pairPositions.values()).map(p => p.y)
    return { canvasW: Math.max(...xs) + PAIR_W + 60, canvasH: Math.max(...ys) + PAIR_H + 80 }
  }, [pairPositions])

  // ── Fit view ─────────────────────────────────────────────────────────────────
  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || pairPositions.size === 0) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    if (cw === 0 || ch === 0) return

    const ps  = Array.from(pairPositions.values())
    const pad = 48
    const bx0 = Math.min(...ps.map(p => p.x))
    const bx1 = Math.max(...ps.map(p => p.x)) + PAIR_W
    const by0 = Math.min(...ps.map(p => p.y))
    const by1 = Math.max(...ps.map(p => p.y)) + PAIR_H
    const bw  = bx1 - bx0 + pad * 2
    const bh  = by1 - by0 + pad * 2
    const s   = Math.max(0.3, Math.min(cw / bw, ch / bh, 1.15))

    setScale(s)
    setPan({
      x: (cw - bw * s) / 2 - bx0 * s + pad * s,
      y: (ch - bh * s) / 2 - by0 * s + pad * s,
    })
  }, [pairPositions])

  useEffect(() => {
    if (pairs.length > 0) {
      const t = setTimeout(fitView, 80)
      return () => clearTimeout(t)
    }
  }, [pairs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // close colour menu on outside click
  useEffect(() => {
    if (!colorMenu) return
    const close = () => setColorMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [colorMenu])

  // ── Drag / pan handlers ───────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    isDragging.current = true
    setDragging(true)
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    setPan({
      x: dragOrigin.current.px + (e.clientX - dragOrigin.current.mx),
      y: dragOrigin.current.py + (e.clientY - dragOrigin.current.my),
    })
  }
  function onPointerUp() {
    isDragging.current = false
    setDragging(false)
  }

  // ── Edge rendering ────────────────────────────────────────────────────────────
  function renderEdges() {
    return pairs.flatMap((pair) => {
      if (!pair.parentPairId) return []
      const p0 = pairPositions.get(pair.parentPairId)
      const p1 = pairPositions.get(pair.id)
      if (!p0 || !p1) return []

      const x1 = p0.x + PAIR_W / 2
      const y1 = p0.y + (nodeColors[pair.parentPairId] ? PAIR_H : PAIR_H) // always from bottom of parent
      const x2 = p1.x + PAIR_W / 2
      const y2 = p1.y

      const isStraight = Math.abs(x1 - x2) < 2
      if (isStraight) {
        return [<line key={`e-${pair.id}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />]
      }
      const cy = y1 + (y2 - y1) * 0.5
      return [<path key={`e-${pair.id}`}
        d={`M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`}
        stroke="var(--edge-color)" strokeWidth="1.5" strokeDasharray="4 3"
        fill="none" strokeLinecap="round" />]
    })
  }

  // ── Collapsed strip ───────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div style={{ width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', borderLeft: '1px solid var(--border)', background: 'var(--tree-bg)', height: '100vh' }}>
        <button onClick={() => setCollapsed(false)} title="Expand tree"
          style={{ marginTop: 12, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 2L0 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
          </svg>
        </button>
        <div style={{ marginTop: 16, opacity: 0.22, color: 'var(--text-primary)' }}>
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

  // ── Full panel ────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: 284, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--tree-bg)', height: '100vh', position: 'relative' }}>

      {/* ── Header ── */}
      <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 12px 0 14px', borderBottom: '1px solid var(--border)', background: 'var(--topbar-bg)', gap: 6 }}>
        <button onClick={() => setCollapsed(true)} title="Collapse tree"
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, transition: 'background 0.1s, color 0.1s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
          </svg>
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Tree Diagram</span>
        <span style={{ fontSize: 11, background: 'var(--bg-muted)', color: 'var(--text-muted)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>
          {allDbNodes.length}
        </span>
      </div>

      {/* ── Canvas (free pan + dotted grid) ── */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: dragging ? 'grabbing' : 'grab',
          // Dot grid — moves with pan so you can see motion
          backgroundImage: 'radial-gradient(circle, var(--border-strong) 1.2px, transparent 1.2px)',
          backgroundSize: `${GRID_PX * scale}px ${GRID_PX * scale}px`,
          backgroundPosition: `${((pan.x % (GRID_PX * scale)) + GRID_PX * scale) % (GRID_PX * scale)}px ${((pan.y % (GRID_PX * scale)) + GRID_PX * scale) % (GRID_PX * scale)}px`,
        }}
      >
        {pairs.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20, cursor: 'default' }}>
            Nodes will appear<br />as you chat
          </div>
        ) : (
          // Transformed canvas — all nodes/edges live here
          <div
            style={{
              position: 'absolute', top: 0, left: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              width: canvasW, height: canvasH,
              userSelect: 'none',
            }}
          >
            {/* SVG edges */}
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={canvasW} height={canvasH}>
              {renderEdges()}
            </svg>

            {/* Pair cards */}
            {pairs.map((pair) => {
              const pos = pairPositions.get(pair.id)
              if (!pos) return null

              const isActive  = pair.id === selectedNodeId || pair.userNode.id === selectedNodeId || (pair.aiNode && pair.aiNode.id === selectedNodeId)
              const isHovered = pair.id === hoveredId
              const color     = nodeColors[pair.id] || nodeColors[pair.userNode.id] || (pair.aiNode ? nodeColors[pair.aiNode.id] : '') || ''
              const pairH     = pair.aiNode ? PAIR_H : USER_H

              const borderCol = color ? color
                : isActive  ? 'var(--node-active-border)'
                : isHovered ? 'var(--border-strong)'
                : 'var(--node-border)'

              const bgCol = color ? `${color}14`
                : isActive ? 'var(--node-active-bg)'
                : 'var(--node-bg)'

              return (
                <div
                  key={pair.id}
                  data-node="true"
                  onClick={() => handleNodeClick(pair.aiNode?.id ?? pair.userNode.id)}
                  onMouseEnter={() => setHoveredId(pair.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: 'absolute',
                    left: pos.x, top: pos.y,
                    width: PAIR_W, height: pairH,
                    background: bgCol,
                    border: `1.5px solid ${borderCol}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    boxShadow: isActive
                      ? `0 0 0 3px ${color ? color + '30' : 'var(--accent-bg)'}`
                      : isHovered ? 'var(--shadow-sm)' : 'none',
                    transition: 'border-color 0.12s, box-shadow 0.12s',
                  }}
                >
                  {/* ── User row ── */}
                  <div style={{ height: USER_H, display: 'flex', alignItems: 'center', gap: 7, padding: '0 6px 0 10px' }}>
                    {/* user icon */}
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
                      <circle cx="4.5" cy="3" r="1.8" stroke="#3b82f6" strokeWidth="1.1" />
                      <path d="M1 8.5a3.5 3.5 0 0 1 7 0" stroke="#3b82f6" strokeWidth="1.1" strokeLinecap="round" />
                    </svg>
                    <span style={{ flex: 1, fontSize: 10.5, lineHeight: 1.4, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {truncate(pair.userNode.content, 24)}
                    </span>
                    {/* colour ⋯ button */}
                    <button
                      data-node="true"
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = e.currentTarget.getBoundingClientRect()
                        setColorMenu({ nodeId: pair.id, x: r.left - 142, y: r.bottom + 6 })
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 2px', borderRadius: 4, flexShrink: 0, opacity: isHovered ? 1 : 0, transition: 'opacity 0.1s', lineHeight: 0 }}
                      title="Node color"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="2" r="1" fill="currentColor" />
                        <circle cx="6" cy="6" r="1" fill="currentColor" />
                        <circle cx="6" cy="10" r="1" fill="currentColor" />
                      </svg>
                    </button>
                  </div>

                  {/* ── Divider + AI row ── */}
                  {pair.aiNode && (
                    <>
                      <div style={{ height: 1, background: borderCol, opacity: 0.35 }} />
                      <div style={{ height: AI_H, display: 'flex', alignItems: 'center', gap: 7, padding: '0 10px' }}>
                        {/* AI icon */}
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.8 }}>
                          <circle cx="5" cy="5" r="2" stroke="var(--accent)" strokeWidth="1.1" />
                          <path d="M5 1v1.2M5 7.8V9M1 5h1.2M7.8 5H9" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round" />
                        </svg>
                        <span style={{ flex: 1, fontSize: 10.5, lineHeight: 1.4, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {truncate(pair.aiNode.content, 24)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Zoom toolbar (bottom-left floating) ── */}
      {pairs.length > 0 && (
        <div style={{ position: 'absolute', bottom: 68, left: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
          {([
            { title: 'Zoom in',  action: () => setScale(s => Math.min(2, +(s + 0.15).toFixed(2))),  icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> },
            { title: 'Zoom out', action: () => setScale(s => Math.max(0.3, +(s - 0.15).toFixed(2))), icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> },
            { title: 'Fit view', action: fitView, icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /></svg> },
          ] as const).map(({ title, action, icon }) => (
            <button key={title} onClick={action} title={title}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--modal-bg)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
            >{icon}</button>
          ))}
        </div>
      )}

      {/* ── Branch button (bottom-centre floating) ── */}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <button
          onClick={() => chatInputRef?.current?.focus()}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', boxShadow: 'var(--shadow-md)', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
          onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--accent-bg)'; b.style.borderColor = 'var(--accent)'; b.style.color = 'var(--accent-text)'; b.style.boxShadow = '0 0 0 3px var(--accent-bg), var(--shadow-md)' }}
          onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--modal-bg)'; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text-secondary)'; b.style.boxShadow = 'var(--shadow-md)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="3"  r="1.8" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="3" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="11" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3" />
            <path d="M3 4.8v4.4M3 4.8c0 0 .5 2.2 4 2.2h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Branch
        </button>
      </div>

      {/* ── Colour picker popup ── */}
      {colorMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: colorMenu.x, top: colorMenu.y, background: 'var(--modal-bg)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '10px 12px', boxShadow: 'var(--shadow-lg)', zIndex: 9999, minWidth: 144 }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Node colour
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {PALETTE.map((p) => {
              const active = (nodeColors[colorMenu.nodeId] ?? '') === p.hex
              return (
                <button key={p.id} title={p.label}
                  onClick={() => { setNodeColor(colorMenu.nodeId, p.hex); setColorMenu(null) }}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: p.hex || 'var(--bg-muted)', border: active ? '2.5px solid var(--text-primary)' : `1.5px solid ${p.hex ? p.hex + '55' : 'var(--border)'}`, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: active ? `0 0 0 2px var(--modal-bg), 0 0 0 4px ${p.hex || 'var(--border)'}` : 'none', transition: 'box-shadow 0.12s' }}
                >
                  {active && (
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
