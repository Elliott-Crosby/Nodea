'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DemoNode, NodeMeta, StickySeed } from './demoSeed'

// ── Layout constants (mirrors the real TreePanel so the canvas looks identical) ──
const LAYOUT_W           = 240
const H_SPACING          = 280
const V_SPACING          = 172
const GRID_PX            = 24
const NODE_W             = 240
const NODE_H             = 84
const MIN_READABLE_SCALE = 0.46
const COMPACT_BELOW      = 0.62  // hide the summary line below this zoom

const GHOST_ID = '__ghost__'

// ── Sticky-note constants (lifted from the real TreePanel) ──────────────────────
const STICKY_MIN_W       = 140
const STICKY_MIN_H       = 80
const STICKY_HEADER_H    = 26
const STICKY_BG          = '#FEF9A7'
const STICKY_HEADER_LINE = 'rgba(0,0,0,0.06)'
const STICKY_TEXT        = '#2C1810'
const STICKY_BTN         = '#7a5c2e'

interface Pair {
  id:           string
  userNode:     DemoNode
  aiNode:       DemoNode | null
  parentPairId: string | null
}

interface StickyNote {
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
  collapsed: boolean
}

// ── Build prompt→reply pairs from the flat node list ────────────────────────────
function buildPairs(nodes: DemoNode[]): Pair[] {
  const nodeMap       = new Map(nodes.map((n) => [n.id, n]))
  const pairs: Pair[] = []
  const pairedUserIds = new Set<string>()
  const sorted        = [...nodes].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))

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

  for (const node of sorted) {
    if (node.role !== 'user' || pairedUserIds.has(node.id)) continue
    let parentPairId: string | null = null
    const parent = node.parent_id ? nodeMap.get(node.parent_id) : null
    if (parent?.role === 'assistant') parentPairId = parent.id
    pairs.push({ id: node.id, userNode: node, aiNode: null, parentPairId })
  }

  return pairs
}

// ── Leaf-counting (Reingold-Tilford style) layout ───────────────────────────────
function computeLayout(pairs: Pair[]): Map<string, { x: number; y: number }> {
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
    const xs = children.map((c) => walk(c.id, depth + 1))
    const x  = (xs[0] + xs[xs.length - 1]) / 2
    positions.set(id, { x, y: depth * V_SPACING })
    return x
  }

  for (const root of childrenMap.get(null) ?? []) walk(root.id, 0)
  return positions
}

function getActivePairIds(pairs: Pair[], selectedNodeId: string | null): Set<string> {
  if (!selectedNodeId) return new Set()
  const selPair = pairs.find(
    (p) => p.id === selectedNodeId || p.userNode.id === selectedNodeId || p.aiNode?.id === selectedNodeId,
  )
  if (!selPair) return new Set()

  const pairMap = new Map(pairs.map((p) => [p.id, p]))
  const active  = new Set<string>()
  let cur: Pair | undefined = selPair
  while (cur) {
    active.add(cur.id)
    cur = cur.parentPairId ? pairMap.get(cur.parentPairId) : undefined
  }
  return active
}

function fallbackTitle(prompt: string): string {
  const sentence = prompt.split(/[.!?\n]/)[0].trim()
  return sentence.length <= 42 ? sentence : sentence.slice(0, 41) + '…'
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*+>]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}

// ── Sticky note card (ported from the real TreePanel) ───────────────────────────
function StickyCard({
  note, scale, onUpdate, onDelete, onFront,
}: {
  note: StickyNote
  scale: number
  onUpdate: (patch: Partial<StickyNote>) => void
  onDelete: () => void
  onFront: () => void
}) {
  const [hover, setHover] = useState(false)

  function startDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    e.stopPropagation()
    onFront()
    const sx = e.clientX, sy = e.clientY
    const nx = note.x, ny = note.y
    function move(ev: PointerEvent) {
      onUpdate({ x: nx + (ev.clientX - sx) / scale, y: ny + (ev.clientY - sy) / scale })
    }
    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function startResize(e: React.PointerEvent) {
    e.stopPropagation()
    onFront()
    const sx = e.clientX, sy = e.clientY
    const w0 = note.w, h0 = note.h
    function move(ev: PointerEvent) {
      onUpdate({
        w: Math.max(STICKY_MIN_W, w0 + (ev.clientX - sx) / scale),
        h: Math.max(STICKY_MIN_H, h0 + (ev.clientY - sy) / scale),
      })
    }
    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      data-sticky="true"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute', left: note.x, top: note.y,
        width: note.w, height: note.collapsed ? STICKY_HEADER_H : note.h,
        background: STICKY_BG,
        boxShadow: '0 2px 6px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)',
        borderRadius: 3, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', userSelect: 'none', zIndex: 50,
      }}
    >
      <div
        data-sticky="true"
        onPointerDown={startDrag}
        style={{
          height: STICKY_HEADER_H, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 2px 0 4px', cursor: 'move',
          borderBottom: note.collapsed ? 'none' : `1px solid ${STICKY_HEADER_LINE}`,
        }}
      >
        <button
          data-sticky="true"
          onClick={(e) => { e.stopPropagation(); onUpdate({ collapsed: !note.collapsed }) }}
          title={note.collapsed ? 'Expand' : 'Collapse'}
          style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: STICKY_BTN, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hover ? 1 : 0.55 }}
        >
          {note.collapsed ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4 L5 7 L8 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="2" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          )}
        </button>
        <button
          data-sticky="true"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Delete"
          style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: STICKY_BTN, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hover ? 1 : 0.55 }}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1 1 L8 8 M8 1 L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>

      {!note.collapsed && (
        <>
          <textarea
            data-sticky="true"
            value={note.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            onPointerDown={(e) => { e.stopPropagation(); onFront() }}
            placeholder="Take a note…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              padding: '6px 10px 14px 10px', fontSize: 12.5,
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
              color: STICKY_TEXT, resize: 'none', boxSizing: 'border-box', lineHeight: 1.45,
            }}
          />
          <div
            data-sticky="true"
            onPointerDown={startResize}
            title="Resize"
            style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, cursor: 'nwse-resize' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: 'absolute', right: 1, bottom: 1, opacity: 0.4 }}>
              <line x1="13" y1="6" x2="6" y2="13" stroke={STICKY_TEXT} strokeWidth="1" />
              <line x1="13" y1="10" x2="10" y2="13" stroke={STICKY_TEXT} strokeWidth="1" />
            </svg>
          </div>
        </>
      )}
    </div>
  )
}

interface DemoTreeProps {
  nodes:         DemoNode[]
  meta:          Record<string, NodeMeta>
  colors:        Record<string, string>
  seedStickies:  StickySeed[]
  selectedId:    string | null
  onSelect:      (id: string) => void
  streamingId:   string | null
  ghostParentId: string | null
  ghostText:     string
}

export default function DemoTree({
  nodes, meta, colors, seedStickies, selectedId, onSelect, streamingId, ghostParentId, ghostText,
}: DemoTreeProps) {
  const [scale, setScale] = useState(0.7)
  const [pan,   setPan]   = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [stickies, setStickies] = useState<StickyNote[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const dragOrigin   = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const scaleRef     = useRef(scale)
  scaleRef.current   = scale
  const seededRef    = useRef(false)

  const basePairs = useMemo(() => buildPairs(nodes), [nodes])

  const showGhost = ghostText.trim().length > 0 && !!ghostParentId && !streamingId
  const pairs = useMemo(() => {
    if (!showGhost || !ghostParentId) return basePairs
    const ghost: Pair = {
      id: GHOST_ID,
      userNode: { id: '__ghost_user__', parent_id: ghostParentId, role: 'user', content: '', created_at: '9999-01-01T00:00:00.000Z' },
      aiNode: null,
      parentPairId: ghostParentId,
    }
    return [...basePairs, ghost]
  }, [basePairs, showGhost, ghostParentId])

  const positions     = useMemo(() => computeLayout(pairs), [pairs])
  const activePairIds  = useMemo(() => getActivePairIds(basePairs, selectedId), [basePairs, selectedId])
  const compact        = scale < COMPACT_BELOW

  // Seed sticky notes once, positioned relative to their anchor pair's layout.
  useEffect(() => {
    if (seededRef.current || positions.size === 0) return
    seededRef.current = true
    setStickies(
      seedStickies
        .map((s) => {
          const p = positions.get(s.anchorPairId)
          if (!p) return null
          return { id: s.id, x: p.x + s.dx, y: p.y + s.dy, w: s.w, h: s.h, text: s.text, collapsed: false }
        })
        .filter((s): s is StickyNote => s !== null),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions])

  const updateSticky = useCallback((id: string, patch: Partial<StickyNote>) => {
    setStickies((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])
  const deleteSticky = useCallback((id: string) => {
    setStickies((prev) => prev.filter((s) => s.id !== id))
  }, [])
  const bringToFront = useCallback((id: string) => {
    setStickies((prev) => {
      const i = prev.findIndex((s) => s.id === id)
      if (i < 0 || i === prev.length - 1) return prev
      const next = [...prev]
      next.push(next.splice(i, 1)[0])
      return next
    })
  }, [])

  const { canvasW, canvasH } = useMemo(() => {
    if (positions.size === 0) return { canvasW: 400, canvasH: 400 }
    const xs = Array.from(positions.values()).map((p) => p.x)
    const ys = Array.from(positions.values()).map((p) => p.y)
    return { canvasW: Math.max(...xs) + LAYOUT_W + 80, canvasH: Math.max(...ys) + NODE_H + 80 }
  }, [positions])

  // ── Fit everything (nodes + stickies) into view ────────────────────────────────
  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || positions.size === 0) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    if (cw === 0 || ch === 0) return

    const ps = Array.from(positions.values())
    let bx0 = Math.min(...ps.map((p) => p.x))
    let bx1 = Math.max(...ps.map((p) => p.x)) + LAYOUT_W
    let by0 = Math.min(...ps.map((p) => p.y))
    let by1 = Math.max(...ps.map((p) => p.y)) + NODE_H
    for (const s of stickies) {
      bx0 = Math.min(bx0, s.x); bx1 = Math.max(bx1, s.x + s.w)
      by0 = Math.min(by0, s.y); by1 = Math.max(by1, s.y + s.h)
    }

    const pad = 52
    const bw  = bx1 - bx0 + pad * 2
    const bh  = by1 - by0 + pad * 2
    const s   = Math.max(MIN_READABLE_SCALE, Math.min(cw / bw, ch / bh, 1.05))
    setScale(s)
    setPan({ x: (cw - (bx1 - bx0) * s) / 2 - bx0 * s, y: (ch - (by1 - by0) * s) / 2 - by0 * s })
  }, [positions, stickies])

  // Keep the latest fitView in a ref so the effects below can call it without
  // depending on its identity — otherwise every sticky drag (which changes the
  // `stickies` array → a new fitView) would re-subscribe the ResizeObserver,
  // which fires on subscribe and re-fits the canvas mid-drag (the "weird
  // movement"). With the ref, neither effect re-runs while dragging.
  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView

  // Fit on mount + on structural changes only: a new branch (pairCount) or a
  // sticky added/removed (stickies.length). A drag changes neither.
  const pairCount = basePairs.length
  useEffect(() => {
    const t2 = setTimeout(() => fitViewRef.current(), 60)
    return () => clearTimeout(t2)
  }, [pairCount, stickies.length])

  // Refit only on a genuine container resize. Subscribed once (empty deps) so a
  // drag can never cause a re-subscribe → spurious refit.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => fitViewRef.current())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Wheel: zoom (mouse/pinch) or pan (trackpad) ─────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function isMouseWheel(e: WheelEvent) {
      if (e.deltaMode !== 0) return true
      return e.deltaX === 0 && Math.abs(e.deltaY) >= 100 && Number.isInteger(e.deltaY)
    }
    function onWheel(e: WheelEvent) {
      if ((e.target as HTMLElement).closest('[data-sticky]')) return
      e.preventDefault()
      if (e.ctrlKey || isMouseWheel(e)) {
        const rect  = el!.getBoundingClientRect()
        const mx    = e.clientX - rect.left
        const my    = e.clientY - rect.top
        const f     = e.deltaY < 0 ? 1.1 : 0.91
        const cur   = scaleRef.current
        const next  = Math.max(0.3, Math.min(1.8, cur * f))
        const ratio = next / cur
        setScale(next)
        setPan((p) => ({ x: mx - ratio * (mx - p.x), y: my - ratio * (my - p.y) }))
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Pan by dragging the background ──────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-node]') || (e.target as HTMLElement).closest('[data-sticky]')) return
    isDragging.current = true
    setDragging(true)
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    setPan({ x: dragOrigin.current.px + (e.clientX - dragOrigin.current.mx), y: dragOrigin.current.py + (e.clientY - dragOrigin.current.my) })
  }
  function onPointerUp() {
    isDragging.current = false
    setDragging(false)
  }

  function renderEdges() {
    return pairs.flatMap((pair) => {
      if (!pair.parentPairId) return []
      const p0 = positions.get(pair.parentPairId)
      const p1 = positions.get(pair.id)
      if (!p0 || !p1) return []
      const isGhost      = pair.id === GHOST_ID
      const isActivePath = !isGhost && activePairIds.has(pair.id) && activePairIds.has(pair.parentPairId)
      const cx = LAYOUT_W / 2
      const x1 = p0.x + cx, y1 = p0.y + NODE_H
      const x2 = p1.x + cx, y2 = p1.y
      const stroke = isGhost ? 'var(--text-muted)' : isActivePath ? 'var(--edge-active)' : 'var(--edge-color)'
      const sw     = isActivePath ? 2 : 1.5
      const dash   = isGhost || !isActivePath ? '4 3' : undefined
      const cy     = y1 + (y2 - y1) * 0.5
      return [
        <path key={`e-${pair.id}`} d={`M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} fill="none" strokeLinecap="round" />,
      ]
    })
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'grab',
        background: 'var(--tree-bg)',
        backgroundImage: 'radial-gradient(circle, var(--grid-dot) 1.3px, transparent 1.3px)',
        backgroundSize: `${GRID_PX * scale}px ${GRID_PX * scale}px`,
        backgroundPosition: `${((pan.x % (GRID_PX * scale)) + GRID_PX * scale) % (GRID_PX * scale)}px ${((pan.y % (GRID_PX * scale)) + GRID_PX * scale) % (GRID_PX * scale)}px`,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: '0 0', width: canvasW, height: canvasH, userSelect: 'none' }}>
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={canvasW} height={canvasH}>
          {renderEdges()}
        </svg>

        {pairs.map((pair) => {
          const pos = positions.get(pair.id)
          if (!pos) return null
          const offsetX = pos.x + (LAYOUT_W - NODE_W) / 2

          if (pair.id === GHOST_ID) {
            const text = ghostText.trim()
            const shown = text.length > 38 ? text.slice(0, 37) + '…' : text
            return (
              <div key={GHOST_ID} data-node="true" style={{ position: 'absolute', left: offsetX, top: pos.y, opacity: 0.55, pointerEvents: 'none' }}>
                <div style={{ width: NODE_W, height: NODE_H, background: 'var(--node-bg)', border: '1.5px dashed var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box' }}>
                  <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shown || 'New branch…'}</span>
                </div>
              </div>
            )
          }

          const isActive   = activePairIds.size > 0 && (pair.id === selectedId || pair.userNode.id === selectedId || pair.aiNode?.id === selectedId)
          const isOnPath   = activePairIds.has(pair.id)
          const isInactive = activePairIds.size > 0 && !isOnPath
          const isHovered  = pair.id === hoveredId
          const isThinking = pair.aiNode?.id === streamingId && !pair.aiNode?.content.trim()
          const color      = colors[pair.id] || ''

          const m       = meta[pair.id]
          const title   = m?.title || fallbackTitle(pair.userNode.content)
          const summary = isThinking ? 'Thinking…' : m?.summary || (pair.aiNode ? stripMarkdown(pair.aiNode.content) : '')

          const borderCol = color ? color : isActive ? 'var(--accent)' : isHovered ? 'var(--border-strong)' : 'var(--node-border)'
          const bgCol     = color ? `${color}14` : isActive ? 'var(--node-active-bg)' : 'var(--node-bg)'
          const ring      = isActive ? `0 0 0 3px ${color ? color + '33' : 'var(--accent-bg)'}` : isHovered ? 'var(--shadow-sm)' : 'none'

          return (
            <div
              key={pair.id}
              data-node="true"
              onClick={() => onSelect(pair.aiNode?.id ?? pair.userNode.id)}
              onMouseEnter={() => setHoveredId(pair.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'absolute', left: offsetX, top: pos.y, width: NODE_W, height: NODE_H,
                background: bgCol,
                border: `1.5px ${isThinking ? 'dashed' : 'solid'} ${isThinking ? 'var(--accent)' : borderCol}`,
                borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
                opacity: isInactive ? 0.62 : 1,
                boxShadow: ring,
                transition: 'border-color 0.12s, box-shadow 0.12s, opacity 0.2s',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ padding: compact ? '0 12px' : '10px 12px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: compact ? 0 : 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />}
                  <span style={{ fontSize: compact ? 13 : 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{title}</span>
                </div>
                {!compact && summary && (
                  <span style={{ fontSize: 11, color: isThinking ? 'var(--text-muted)' : 'var(--text-secondary)', fontStyle: isThinking ? 'italic' : 'normal', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{summary}</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Sticky notes render above the tree nodes */}
        {stickies.map((note) => (
          <StickyCard
            key={note.id}
            note={note}
            scale={scale}
            onUpdate={(patch) => updateSticky(note.id, patch)}
            onDelete={() => deleteSticky(note.id)}
            onFront={() => bringToFront(note.id)}
          />
        ))}
      </div>
    </div>
  )
}
