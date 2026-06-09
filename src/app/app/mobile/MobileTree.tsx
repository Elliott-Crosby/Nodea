'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type MNode, type Pair,
  buildPairs, computePairLayout, activePairIds, pairChildren,
  generateTitle, generateSummary,
} from './treeModel'
import { IcZoomIn, IcZoomOut, IcFit, IcBranch } from './MobileUI'

const NODE_W = 184, NODE_H = 86, HSP = 206, VSP = 128, PAD = 80

interface MobileTreeProps {
  nodes: MNode[]
  selectedId: string | null
  newIds?: Set<string>
  active: boolean
  fitKey: number
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onBranch: (node: MNode) => void
}

export function MobileTree({ nodes, selectedId, newIds, active, fitKey, onSelect, onOpen, onBranch }: MobileTreeProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 40, y: 120, s: 1 })
  const viewRef = useRef(view)
  viewRef.current = view
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; s: number; cx: number; cy: number; vx: number; vy: number } | null>(null)
  const dragged = useRef(false)

  const pairs = useMemo(() => buildPairs(nodes), [nodes])
  const pos = useMemo(() => computePairLayout(pairs, HSP, VSP), [pairs])
  const activeIds = useMemo(() => activePairIds(pairs, selectedId), [pairs, selectedId])
  const selPair = pairs.find((p) => p.id === selectedId || p.userNode.id === selectedId || (p.aiNode && p.aiNode.id === selectedId))

  // bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pairs) {
    const q = pos.get(p.id); if (!q) continue
    minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y)
  }
  if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 0 }
  const place = (q: { x: number; y: number }) => ({ left: q.x - minX + PAD, top: q.y - minY + PAD })
  const contentW = (maxX - minX) + NODE_W + PAD * 2
  const contentH = (maxY - minY) + NODE_H + PAD * 2

  // edges
  const ch = useMemo(() => pairChildren(pairs), [pairs])
  const edges: { key: string; d: string; active: boolean }[] = []
  for (const p of pairs) {
    for (const kid of (ch.get(p.id) || [])) {
      const a = pos.get(p.id), b = pos.get(kid.id); if (!a || !b) continue
      const x1 = a.x - minX + PAD + NODE_W / 2, y1 = a.y - minY + PAD + NODE_H
      const x2 = b.x - minX + PAD + NODE_W / 2, y2 = b.y - minY + PAD
      const cy = y1 + (y2 - y1) * 0.5
      const isA = activeIds.has(p.id) && activeIds.has(kid.id)
      edges.push({ key: p.id + kid.id, d: `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`, active: isA })
    }
  }

  // center on the selected node within the viewport
  const centerOnSel = useCallback((scale?: number) => {
    const wrap = wrapRef.current; if (!wrap || !selPair) return
    const p = pos.get(selPair.id); if (!p) return
    const q = place(p)
    const s = scale != null ? scale : viewRef.current.s
    const vw = wrap.clientWidth, vh = wrap.clientHeight
    const cx = q.left + NODE_W / 2, cy = q.top + NODE_H / 2
    setView({ s, x: vw / 2 - cx * s, y: vh * 0.36 - cy * s })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selPair, pos])

  // fit whole tree
  const fitAll = useCallback(() => {
    const wrap = wrapRef.current; if (!wrap) return
    const vw = wrap.clientWidth, vh = wrap.clientHeight
    const s = Math.max(0.4, Math.min(1.1, Math.min(vw / contentW, vh / contentH) * 0.92))
    setView({ s, x: (vw - contentW * s) / 2, y: (vh - contentH * s) / 2 })
  }, [contentW, contentH])

  // re-center whenever the tree becomes active or selection arrives from chat
  useEffect(() => {
    if (active) { const t = setTimeout(() => centerOnSel(1), 30); return () => clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fitKey])

  // ── pointer pan / pinch ──
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragged.current = false
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y
      pinch.current = { dist: Math.hypot(dx, dy), s: viewRef.current.s,
        cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2, vx: viewRef.current.x, vy: viewRef.current.y }
    }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)!
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const pts = [...pointers.current.values()]
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y
      const dist = Math.hypot(dx, dy)
      const wrap = wrapRef.current!; const rect = wrap.getBoundingClientRect()
      const ns = Math.max(0.34, Math.min(1.8, pinch.current.s * (dist / pinch.current.dist)))
      const mx = pinch.current.cx - rect.left, my = pinch.current.cy - rect.top
      const k = ns / pinch.current.s
      setView({ s: ns, x: mx - (mx - pinch.current.vx) * k, y: my - (my - pinch.current.vy) * k })
      dragged.current = true
      return
    }
    const ddx = e.clientX - prev.x, ddy = e.clientY - prev.y
    if (Math.abs(ddx) + Math.abs(ddy) > 2) dragged.current = true
    setView((v) => ({ ...v, x: v.x + ddx, y: v.y + ddy }))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const zoom = (factor: number) => {
    const wrap = wrapRef.current; if (!wrap) return
    const vw = wrap.clientWidth, vh = wrap.clientHeight
    setView((v) => {
      const ns = Math.max(0.34, Math.min(1.8, v.s * factor))
      const k = ns / v.s
      return { s: ns, x: vw / 2 - (vw / 2 - v.x) * k, y: vh / 2 - (vh / 2 - v.y) * k }
    })
  }

  const tapNode = (p: Pair) => { if (dragged.current) return; onSelect(p.aiNode ? p.aiNode.id : p.userNode.id) }

  return (
    <div className="nm-treewrap" ref={wrapRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="nm-grid" />
      <div className="nm-world" style={{ width: contentW, height: contentH, transform: `translate(${view.x}px,${view.y}px) scale(${view.s})` }}>
        <svg className="nm-edge-svg" style={{ width: contentW, height: contentH }}>
          {edges.map((e) => (
            <path key={e.key} d={e.d} fill="none" strokeLinecap="round"
              strokeWidth={e.active ? 2.4 : 1.6}
              stroke={e.active ? 'var(--edge-active)' : 'var(--edge-color)'}
              strokeDasharray={e.active ? undefined : '4 4'} />
          ))}
        </svg>
        {pairs.map((p) => {
          const point = pos.get(p.id); if (!point) return null
          const q = place(point)
          const isActive = activeIds.has(p.id)
          const isSel = selPair && selPair.id === p.id
          const title = p.userNode.title || generateTitle(p.userNode.text)
          const summary = p.aiNode ? (p.aiNode.summary || generateSummary(p.aiNode.text)) : ''
          return (
            <div key={p.id} className={`nm-tnode ${isActive ? 'active' : ''} ${isSel ? 'sel' : ''} ${newIds && newIds.has(p.id) ? 'nm-tnode-new' : ''}`}
              style={{ left: q.left, top: q.top, width: NODE_W }} onClick={() => tapNode(p)}>
              <div className="nm-ttitle">{p.color && <span className="cdot" style={{ background: p.color }} />}{title}</div>
              {summary ? <div className="nm-tsummary">{summary}</div> : <div className="nm-tsummary nm-tpending">awaiting reply…</div>}
            </div>
          )
        })}
      </div>

      <div className="nm-tphint"><span className="d" />Drag to explore · pinch to zoom · tap a node</div>

      <div className="nm-tctrl">
        <button onClick={() => zoom(1.2)} aria-label="Zoom in"><IcZoomIn s={18} /></button>
        <button onClick={() => zoom(1 / 1.2)} aria-label="Zoom out"><IcZoomOut s={18} /></button>
        <button onClick={fitAll} aria-label="Fit"><IcFit s={18} /></button>
      </div>

      {selPair && (
        <div className="nm-tsel">
          <div className="info">
            <div className="tt">{selPair.userNode.title || generateTitle(selPair.userNode.text)}</div>
            <div className="ss">{selPair.aiNode ? (selPair.aiNode.summary || generateSummary(selPair.aiNode.text)) : 'awaiting reply…'}</div>
          </div>
          <div className="act">
            <button className="fork" onClick={() => onBranch(selPair.aiNode || selPair.userNode)}><IcBranch s={14} />Branch</button>
            <button className="open" onClick={() => onOpen(selPair.aiNode ? selPair.aiNode.id : selPair.userNode.id)}>Open</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mini tree thumbnail (for project conversation rows) ──────
export function MiniThumb({ nodes, color, w = 104, h = 56 }: { nodes: MNode[]; color: string; w?: number; h?: number }) {
  const pairs = buildPairs(nodes)
  const pos = computePairLayout(pairs, 100, 60)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pairs) {
    const q = pos.get(p.id); if (!q) continue
    minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y)
  }
  if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 0 }
  const pad = 9, spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1
  const s = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY)
  const offX = pad + ((w - pad * 2) - spanX * s) / 2
  const offY = pad + ((h - pad * 2) - spanY * s) / 2
  const X = (x: number) => offX + (x - minX) * s
  const Y = (y: number) => offY + (y - minY) * s
  const ch = pairChildren(pairs)
  const edges: { key: string; x1: number; y1: number; x2: number; y2: number }[] = []
  for (const p of pairs) {
    const a = pos.get(p.id)
    for (const kid of (ch.get(p.id) || [])) {
      const b = pos.get(kid.id); if (!a || !b) continue
      edges.push({ key: p.id + kid.id, x1: X(a.x), y1: Y(a.y), x2: X(b.x), y2: Y(b.y) })
    }
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {edges.map((e) => {
        const cy = (e.y1 + e.y2) / 2
        return <path key={e.key} d={`M${e.x1},${e.y1} C${e.x1},${cy} ${e.x2},${cy} ${e.x2},${e.y2}`} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="1.2" />
      })}
      {pairs.map((p) => {
        const q = pos.get(p.id); if (!q) return null
        const root = p.parentPairId == null
        return <circle key={p.id} cx={X(q.x)} cy={Y(q.y)} r="2.7" fill={root ? color : 'var(--node-bg)'} stroke={color} strokeWidth="1.3" />
      })}
    </svg>
  )
}
