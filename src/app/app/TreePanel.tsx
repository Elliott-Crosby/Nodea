'use client'

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useApp, type DbNode } from './App'

// ── Constants ──────────────────────────────────────────────────────────────────
const LAYOUT_W           = 240
const H_SPACING          = 280
const V_SPACING          = 180
const GRID_PX            = 24
const MIN_WIDTH          = 200
const MAX_WIDTH          = 700
const DEFAULT_WIDTH      = 320
const MIN_READABLE_SCALE = 0.65

const NODE_W = { detailed: 240, compact: 190, mini: 150 } as const
const NODE_H = { detailed: 86,  compact: 52,  mini:  40  } as const

// ── Colour palette ─────────────────────────────────────────────────────────────
const PALETTE = [
  { id: 'default', label: 'Default', hex: ''        },
  { id: 'violet',  label: 'Violet',  hex: '#8b5cf6' },
  { id: 'blue',    label: 'Blue',    hex: '#3b82f6' },
  { id: 'green',   label: 'Green',   hex: '#22c55e' },
  { id: 'red',     label: 'Red',     hex: '#ef4444' },
  { id: 'orange',  label: 'Orange',  hex: '#f97316' },
]

// ── Types ──────────────────────────────────────────────────────────────────────
interface Pair {
  id:           string
  userNode:     DbNode
  aiNode:       DbNode | null
  parentPairId: string | null
}

type ZoomMode = 'detailed' | 'compact' | 'mini'

// ── Utility functions ──────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','is','it','in','on','at','to','for','of','and','or','but',
  'this','that','what','how','why','can','you','me','i','my','do','be','are',
  'was','with','as','from','have','has','had','will','not','no','so','get',
  'if','then','please','just','let','know','tell','make','use','need',
])

function generateTitle(userPrompt: string, _aiResponse: string): string {
  const clean = userPrompt.replace(/[^\w\s]/g, ' ').toLowerCase()
  const words = clean.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))

  if (words.length >= 2) {
    return words.slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const sentence = userPrompt.split(/[.!?\n]/)[0].trim()
  if (sentence.length <= 50) return sentence
  return sentence.slice(0, 47) + '…'
}

function generateSummary(aiResponse: string, _userPrompt: string): string {
  const stripped = aiResponse
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`[^`]+`/g, m => m.slice(1, -1))
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+>\d.]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()

  const firstSentence = stripped.match(/^[^.!?]+[.!?]/)?.[0]?.trim() ?? stripped
  return firstSentence.length > 120 ? firstSentence.slice(0, 117) + '…' : firstSentence
}

function getZoomMode(scale: number): ZoomMode {
  if (scale >= 0.85) return 'detailed'
  if (scale >= 0.55) return 'compact'
  return 'mini'
}

function getActivePairIds(pairs: Pair[], selectedNodeId: string | null): Set<string> {
  if (!selectedNodeId) return new Set()

  const selPair = pairs.find(p =>
    p.id === selectedNodeId ||
    p.userNode.id === selectedNodeId ||
    (p.aiNode && p.aiNode.id === selectedNodeId)
  )
  if (!selPair) return new Set()

  const pairMap = new Map(pairs.map(p => [p.id, p]))
  const active  = new Set<string>()
  let   cur: Pair | undefined = selPair
  while (cur) {
    active.add(cur.id)
    cur = cur.parentPairId ? pairMap.get(cur.parentPairId) : undefined
  }
  return active
}

// ── Build pairs from flat node list ───────────────────────────────────────────
function buildPairs(dbNodes: DbNode[]): Pair[] {
  const nodeMap      = new Map(dbNodes.map(n => [n.id, n]))
  const pairs: Pair[]        = []
  const pairedUserIds        = new Set<string>()
  const sorted               = [...dbNodes].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))

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
    const x  = (xs[0] + xs[xs.length - 1]) / 2
    positions.set(id, { x, y: depth * V_SPACING })
    return x
  }

  for (const pair of childrenMap.get(null) ?? []) walk(pair.id, 0)
  return positions
}

// ── Outline view ──────────────────────────────────────────────────────────────
function OutlineView({ pairs, selectedNodeId, handleNodeClick }: {
  pairs: Pair[]
  selectedNodeId: string | null
  handleNodeClick: (id: string) => void
}) {
  const childrenMap = useMemo(() => {
    const m = new Map<string | null, Pair[]>()
    for (const p of pairs) {
      const k = p.parentPairId
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return m
  }, [pairs])

  function renderBranch(pairId: string | null, depth: number): React.ReactElement[] {
    const children = childrenMap.get(pairId) ?? []
    return children.flatMap(pair => {
      const isActive     = pair.id === selectedNodeId || pair.userNode.id === selectedNodeId || (pair.aiNode && pair.aiNode.id === selectedNodeId)
      const title        = generateTitle(pair.userNode.content, pair.aiNode?.content ?? '')
      const summary      = pair.aiNode ? generateSummary(pair.aiNode.content, pair.userNode.content) : ''
      const summaryShort = summary.length > 80 ? summary.slice(0, 77) + '…' : summary
      return [
        <div
          key={pair.id}
          onClick={() => handleNodeClick(pair.aiNode?.id ?? pair.userNode.id)}
          style={{
            paddingLeft:    12 + depth * 16,
            paddingRight:   12,
            paddingTop:     7,
            paddingBottom:  7,
            cursor:         'pointer',
            background:     isActive ? 'var(--node-active-bg)' : 'transparent',
            borderLeft:     isActive ? '2px solid var(--accent)' : '2px solid transparent',
            borderBottom:   '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
            {title}
          </div>
          {summaryShort && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 2 }}>
              {summaryShort}
            </div>
          )}
        </div>,
        ...renderBranch(pair.id, depth + 1),
      ]
    })
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {pairs.length === 0 ? (
        <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
          Nodes will appear<br />as you chat
        </div>
      ) : renderBranch(null, 0)}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TreePanel() {
  const { allDbNodes, selectedNodeId, handleNodeClick, nodeColors, setNodeColor, chatInputRef, lastSavedPairId } = useApp()

  const [collapsed,       setCollapsed]       = useState(false)
  const [viewMode,        setViewMode]        = useState<'tree' | 'outline'>('tree')
  const [autoZoom,        setAutoZoom]        = useState(true)
  const [panelWidth,      setPanelWidth]      = useState(DEFAULT_WIDTH)
  const [hoveredId,       setHoveredId]       = useState<string | null>(null)
  const [hoverPos,        setHoverPos]        = useState<{ x: number; y: number } | null>(null)
  const [colorMenu,       setColorMenu]       = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [scale,           setScale]           = useState(1)
  const [pan,             setPan]             = useState({ x: 0, y: 0 })
  const [dragging,        setDragging]        = useState(false)
  const [scrollbarHover,  setScrollbarHover]  = useState(false)
  const [containerSize,   setContainerSize]   = useState({ w: 0, h: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const dragOrigin   = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const scaleRef     = useRef(scale)
  const panRef       = useRef(pan)  // eslint-disable-line @typescript-eslint/no-unused-vars
  scaleRef.current   = scale
  panRef.current     = pan

  const isResizing   = useRef(false)
  const resizeOrigin = useRef({ x: 0, w: DEFAULT_WIDTH })

  const pairs         = useMemo(() => buildPairs(allDbNodes), [allDbNodes])
  const pairPositions = useMemo(() => computePairLayout(pairs), [pairs])
  const activePairIds = useMemo(() => getActivePairIds(pairs, selectedNodeId), [pairs, selectedNodeId])
  const zoomMode      = getZoomMode(scale)
  const nodeW         = NODE_W[zoomMode]
  const nodeH         = NODE_H[zoomMode]

  const { canvasW, canvasH } = useMemo(() => {
    if (pairPositions.size === 0) return { canvasW: 400, canvasH: 400 }
    const xs = Array.from(pairPositions.values()).map(p => p.x)
    const ys = Array.from(pairPositions.values()).map(p => p.y)
    return {
      canvasW: Math.max(...xs) + LAYOUT_W + 80,
      canvasH: Math.max(...ys) + NODE_H.detailed + 80,
    }
  }, [pairPositions])

  // ── Fit view ──────────────────────────────────────────────────────────────────
  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || pairPositions.size === 0) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    if (cw === 0 || ch === 0) return

    const ps   = Array.from(pairPositions.values())
    const hPad = 40
    const bx0  = Math.min(...ps.map(p => p.x))
    const bx1  = Math.max(...ps.map(p => p.x)) + LAYOUT_W
    const by0  = Math.min(...ps.map(p => p.y))
    const by1  = Math.max(...ps.map(p => p.y)) + NODE_H.detailed
    const bw   = bx1 - bx0 + hPad * 2
    const bh   = by1 - by0

    const sByW = cw / bw
    const sByH = (ch - 28) / (bh + 32)
    const s    = Math.max(MIN_READABLE_SCALE, Math.min(sByW, sByH, 1.15))

    setScale(s)
    setPan({ x: (cw - (bx1 - bx0) * s) / 2 - bx0 * s, y: 24 - by0 * s })
  }, [pairPositions])

  // ── Fit active branch ─────────────────────────────────────────────────────────
  const fitBranch = useCallback(() => {
    const el = containerRef.current
    if (!el || activePairIds.size === 0) { fitView(); return }
    const cw = el.clientWidth
    const ch = el.clientHeight

    const poses = Array.from(activePairIds)
      .map(id => pairPositions.get(id))
      .filter((p): p is { x: number; y: number } => !!p)
    if (!poses.length) return

    const hPad = 60
    const bx0  = Math.min(...poses.map(p => p.x))
    const bx1  = Math.max(...poses.map(p => p.x)) + LAYOUT_W
    const by0  = Math.min(...poses.map(p => p.y))
    const by1  = Math.max(...poses.map(p => p.y)) + NODE_H.detailed
    const bw   = bx1 - bx0 + hPad * 2
    const bh   = by1 - by0

    const sByW = cw / bw
    const sByH = (ch - 28) / (bh + 48)
    const s    = Math.max(MIN_READABLE_SCALE, Math.min(sByW, sByH, 1.15))

    setScale(s)
    setPan({
      x: (cw - (bx1 - bx0) * s) / 2 - bx0 * s,
      y: (ch - (by1 - by0) * s) / 2 - by0 * s,
    })
  }, [activePairIds, pairPositions, fitView])

  // ── Smart zoom to newly-saved node ────────────────────────────────────────────
  const smartZoomToNode = useCallback((pairId: string, chainLen: number) => {
    const el = containerRef.current
    if (!el) return
    const pos = pairPositions.get(pairId)
    if (!pos) return

    const cw = el.clientWidth
    const ch = el.clientHeight

    // Scale: fit the full chain height comfortably, clamped to readable range
    const chainH = Math.max(1, chainLen - 1) * V_SPACING + NODE_H.detailed
    const sByH   = (ch * 0.85) / chainH
    const s      = Math.max(MIN_READABLE_SCALE, Math.min(1.1, sByH))

    // Vertical position: fewer ancestors → node sits higher; more → bottom 25%
    const MAX_CHAIN = 8
    const t          = Math.min((chainLen - 1) / MAX_CHAIN, 1)
    const targetY    = ch * (0.25 + 0.5 * t)  // 25% → 75% down

    setScale(s)
    setPan({
      x: cw / 2 - (pos.x + LAYOUT_W / 2) * s,
      y: targetY  - (pos.y + NODE_H.detailed / 2) * s,
    })
  }, [pairPositions])

  useEffect(() => {
    if (pairs.length > 0) {
      const t = setTimeout(fitView, 80)
      return () => clearTimeout(t)
    }
  }, [pairs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-zoom on new message ──────────────────────────────────────────────────
  useEffect(() => {
    if (!autoZoom || !lastSavedPairId) return
    const chainLen = getActivePairIds(pairs, lastSavedPairId).size
    const t = setTimeout(() => smartZoomToNode(lastSavedPairId, chainLen), 80)
    return () => clearTimeout(t)
  }, [lastSavedPairId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll-wheel: plain = zoom, Ctrl = pan ────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (e.ctrlKey) {
        // Ctrl+scroll → pan up/down (and left/right if deltaX present)
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      } else {
        // Plain scroll → zoom centred on cursor
        const rect  = el!.getBoundingClientRect()
        const mx    = e.clientX - rect.left
        const my    = e.clientY - rect.top
        const f     = e.deltaY < 0 ? 1.10 : 0.91
        const cur   = scaleRef.current
        const next  = Math.max(0.25, Math.min(2.5, cur * f))
        const ratio = next / cur
        setScale(next)
        setPan(p => ({ x: mx - ratio * (mx - p.x), y: my - ratio * (my - p.y) }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track container size for scrollbar ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [viewMode])

  // ── Close colour menu on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!colorMenu) return
    const close = () => setColorMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [colorMenu])

  // ── Panel resize ──────────────────────────────────────────────────────────────
  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isResizing.current   = true
    resizeOrigin.current = { x: e.clientX, w: panelWidth }

    function onMove(ev: MouseEvent) {
      if (!isResizing.current) return
      const delta = resizeOrigin.current.x - ev.clientX
      setPanelWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeOrigin.current.w + delta)))
    }
    function onUp() {
      isResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Canvas drag / pan ─────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    isDragging.current = true
    setDragging(true)
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    setPan({ x: dragOrigin.current.px + (e.clientX - dragOrigin.current.mx), y: dragOrigin.current.py + (e.clientY - dragOrigin.current.my) })
  }
  function onPointerUp() { isDragging.current = false; setDragging(false) }

  // ── Edges ─────────────────────────────────────────────────────────────────────
  function renderEdges() {
    return pairs.flatMap((pair) => {
      if (!pair.parentPairId) return []
      const p0 = pairPositions.get(pair.parentPairId)
      const p1 = pairPositions.get(pair.id)
      if (!p0 || !p1) return []

      const isActivePath = activePairIds.has(pair.id) && activePairIds.has(pair.parentPairId)
      const cx           = LAYOUT_W / 2
      const x1           = p0.x + cx
      const y1           = p0.y + nodeH
      const x2           = p1.x + cx
      const y2           = p1.y
      const stroke       = isActivePath ? 'var(--accent)' : 'var(--edge-color)'
      const sw           = isActivePath ? 2 : 1.5
      const dash         = isActivePath ? undefined : '4 3'

      if (Math.abs(x1 - x2) < 2) {
        return [<line key={`e-${pair.id}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />]
      }
      const cy = y1 + (y2 - y1) * 0.5
      return [<path key={`e-${pair.id}`}
        d={`M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`}
        stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
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
    <div style={{ width: panelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--tree-bg)', height: '100vh', position: 'relative' }}>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        style={{ position: 'absolute', left: 0, top: 0, width: 5, height: '100%', cursor: 'col-resize', zIndex: 20, background: 'transparent', transition: 'background 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.opacity = '0.35' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
        title="Drag to resize"
      />

      {/* Header */}
      <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 10px 0 14px', borderBottom: '1px solid var(--border)', background: 'var(--topbar-bg)', gap: 6 }}>
        <button onClick={() => setCollapsed(true)} title="Collapse tree"
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, transition: 'background 0.1s, color 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
          </svg>
        </button>

        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Conversation Tree</span>

        {/* Tree / Outline toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-muted)', borderRadius: 8, padding: 2, gap: 2, flexShrink: 0 }}>
          {(['tree', 'outline'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={mode === 'tree' ? 'Tree view' : 'Outline view'}
              style={{
                width: 26, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background:   viewMode === mode ? 'var(--modal-bg)' : 'transparent',
                border:       viewMode === mode ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 6,
                cursor:       'pointer',
                color:        viewMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                transition:   'all 0.1s',
              }}
            >
              {mode === 'tree' ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="4" y="0.5" width="4" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="0.5" y="8.5" width="3.5" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="8" y="8.5" width="3.5" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
                  <line x1="6" y1="3.5" x2="6" y2="6.5" stroke="currentColor" strokeWidth="1.1" />
                  <line x1="6" y1="6.5" x2="2.25" y2="8.5" stroke="currentColor" strokeWidth="1.1" />
                  <line x1="6" y1="6.5" x2="9.75" y2="8.5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <line x1="3" y1="6.5" x2="11" y2="6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <line x1="5" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, background: 'var(--bg-muted)', color: 'var(--text-muted)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>
          {allDbNodes.length}
        </span>
      </div>

      {/* Outline view */}
      {viewMode === 'outline' ? (
        <OutlineView pairs={pairs} selectedNodeId={selectedNodeId} handleNodeClick={handleNodeClick} />
      ) : (
        /* Canvas */
        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            flex: 1, overflow: 'hidden', position: 'relative',
            cursor: dragging ? 'grabbing' : 'grab',
            backgroundImage: 'radial-gradient(circle, var(--grid-dot) 1.3px, transparent 1.3px)',
            backgroundSize: `${GRID_PX * scale}px ${GRID_PX * scale}px`,
            backgroundPosition: `${((pan.x % (GRID_PX * scale)) + GRID_PX * scale) % (GRID_PX * scale)}px ${((pan.y % (GRID_PX * scale)) + GRID_PX * scale) % (GRID_PX * scale)}px`,
          }}
        >
          {pairs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20, cursor: 'default' }}>
              Nodes will appear<br />as you chat
            </div>
          ) : (
            <div style={{
              position: 'absolute', top: 0, left: 0,
              transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              width: canvasW, height: canvasH,
              userSelect: 'none',
            }}>
              <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={canvasW} height={canvasH}>
                {renderEdges()}
              </svg>

              {pairs.map((pair) => {
                const pos = pairPositions.get(pair.id)
                if (!pos) return null

                const isActive   = pair.id === selectedNodeId || pair.userNode.id === selectedNodeId || (pair.aiNode && pair.aiNode.id === selectedNodeId)
                const isOnPath   = activePairIds.has(pair.id)
                const isHovered  = pair.id === hoveredId
                const isInactive = activePairIds.size > 0 && !isOnPath
                const color      = nodeColors[pair.id] || nodeColors[pair.userNode.id] || (pair.aiNode ? nodeColors[pair.aiNode.id] : '') || ''

                const title   = generateTitle(pair.userNode.content, pair.aiNode?.content ?? '')
                const summary = pair.aiNode ? generateSummary(pair.aiNode.content, pair.userNode.content) : ''

                const borderCol = color
                  ? color
                  : isActive  ? 'var(--accent)'
                  : isHovered ? 'var(--border-strong)'
                  : 'var(--node-border)'

                const bgCol = color
                  ? `${color}14`
                  : isActive ? 'var(--node-active-bg)'
                  : 'var(--node-bg)'

                const offsetX = pos.x + (LAYOUT_W - nodeW) / 2

                return (
                  <div
                    key={pair.id}
                    data-node="true"
                    style={{
                      position:   'absolute',
                      left:       offsetX,
                      top:        pos.y,
                      zIndex:     isHovered ? 10 : 1,
                      opacity:    isInactive ? 0.72 : 1,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={e => {
                      setHoveredId(pair.id)
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoverPos({ x: rect.right + 8, y: rect.top })
                    }}
                    onMouseLeave={() => { setHoveredId(null); setHoverPos(null) }}
                  >
                    <div
                      data-node="true"
                      onClick={() => handleNodeClick(pair.aiNode?.id ?? pair.userNode.id)}
                      style={{
                        width:      nodeW,
                        height:     nodeH,
                        background: bgCol,
                        border:     `1.5px solid ${borderCol}`,
                        borderRadius: 10,
                        cursor:     'pointer',
                        overflow:   'hidden',
                        position:   'relative',
                        boxShadow:  isActive
                          ? `0 0 0 3px ${color ? color + '30' : 'var(--accent-bg)'}`
                          : isHovered ? 'var(--shadow-sm)' : 'none',
                        transition: 'border-color 0.12s, box-shadow 0.12s',
                      }}
                    >
                      {/* Detailed: title + summary + Active badge */}
                      {zoomMode === 'detailed' && (
                        <div style={{ padding: '9px 10px 8px 10px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {title}
                            </span>
                            {isActive && (
                              <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: 'white', borderRadius: 6, padding: '1px 5px', flexShrink: 0, letterSpacing: '0.04em' }}>
                                Active
                              </span>
                            )}
                          </div>
                          {summary && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', maxHeight: 32 }}>
                              {summary}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Compact: title + one-line summary */}
                      {zoomMode === 'compact' && (
                        <div style={{ padding: '7px 9px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {title}
                          </div>
                          {summary && (
                            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {summary}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Mini: title only */}
                      {zoomMode === 'mini' && (
                        <div style={{ padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>
                          <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                            {title}
                          </div>
                        </div>
                      )}

                      {/* Color ⋯ button — top-right, shown on hover */}
                      <button
                        data-node="true"
                        onClick={e => {
                          e.stopPropagation()
                          const r = e.currentTarget.getBoundingClientRect()
                          setColorMenu({ nodeId: pair.id, x: r.left - 150, y: r.bottom + 6 })
                        }}
                        style={{
                          position:   'absolute', top: 4, right: 4,
                          background: 'var(--modal-bg)', border: '1px solid var(--border)',
                          cursor:     'pointer', color: 'var(--text-muted)',
                          padding:    '2px 3px', borderRadius: 5,
                          opacity:    isHovered ? 1 : 0, transition: 'opacity 0.1s', lineHeight: 0,
                        }}
                        title="Node color"
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="2"  r="1" fill="currentColor" />
                          <circle cx="6" cy="6"  r="1" fill="currentColor" />
                          <circle cx="6" cy="10" r="1" fill="currentColor" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Vertical scrollbar ── */}
          {(() => {
            const ch       = containerSize.h
            const totalH   = canvasH * scale + 80
            if (ch <= 0 || totalH <= ch) return null

            const maxScroll = totalH - ch
            const scrollY   = Math.max(0, Math.min(-pan.y, maxScroll))
            const trackH    = ch - 16
            const thumbH    = Math.max(28, (ch / totalH) * trackH)
            const thumbTop  = 8 + (scrollY / maxScroll) * (trackH - thumbH)
            const visible   = scrollbarHover || dragging

            return (
              <div
                style={{
                  position: 'absolute', right: 3, top: 0, bottom: 0,
                  width: 8, display: 'flex', alignItems: 'flex-start',
                  pointerEvents: 'auto', zIndex: 15,
                }}
                onMouseEnter={() => setScrollbarHover(true)}
                onMouseLeave={() => setScrollbarHover(false)}
              >
                {/* track */}
                <div style={{
                  position: 'absolute', top: 6, bottom: 6, left: 2, right: 2,
                  borderRadius: 4,
                  background: visible ? 'var(--border)' : 'transparent',
                  transition: 'background 0.15s',
                }} />
                {/* thumb */}
                <div
                  style={{
                    position: 'absolute',
                    top: thumbTop,
                    left: 2, right: 2,
                    height: thumbH,
                    borderRadius: 4,
                    background: visible ? 'var(--text-muted)' : 'transparent',
                    opacity: visible ? 0.7 : 0,
                    transition: 'background 0.15s, opacity 0.15s',
                    cursor: 'ns-resize',
                  }}
                  onMouseDown={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    const startY    = e.clientY
                    const startPanY = pan.y
                    const ch2       = containerSize.h
                    const totalH2   = canvasH * scaleRef.current + 80
                    const maxScroll2 = Math.max(0, totalH2 - ch2)
                    const trackH2   = ch2 - 16
                    const thumbH2   = Math.max(28, (ch2 / totalH2) * trackH2)
                    const scrollPerPx = maxScroll2 / Math.max(1, trackH2 - thumbH2)
                    function onMove(ev: MouseEvent) {
                      const dy = ev.clientY - startY
                      setPan(p => ({ ...p, y: Math.min(0, Math.max(-maxScroll2, startPanY - dy * scrollPerPx)) }))
                    }
                    function onUp() {
                      window.removeEventListener('mousemove', onMove)
                      window.removeEventListener('mouseup', onUp)
                    }
                    window.addEventListener('mousemove', onMove)
                    window.addEventListener('mouseup', onUp)
                  }}
                />
              </div>
            )
          })()}
        </div>
      )}

      {/* Hover popover */}
      {hoveredId && hoverPos && viewMode === 'tree' && (() => {
        const pair = pairs.find(p => p.id === hoveredId)
        if (!pair) return null
        const title         = generateTitle(pair.userNode.content, pair.aiNode?.content ?? '')
        const summary       = pair.aiNode ? generateSummary(pair.aiNode.content, pair.userNode.content) : ''
        const promptPreview = pair.userNode.content.length > 100
          ? pair.userNode.content.slice(0, 97) + '…'
          : pair.userNode.content
        return (
          <div style={{
            position: 'fixed', left: hoverPos.x, top: hoverPos.y,
            zIndex: 9999, pointerEvents: 'none',
            background: 'var(--modal-bg)', border: '1px solid var(--border-strong)',
            borderRadius: 10, padding: '10px 12px',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: 260, minWidth: 180,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
              {title}
            </div>
            {summary && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                {summary}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 6, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 600 }}>Prompt: </span>{promptPreview}
            </div>
          </div>
        )
      })()}

      {/* Zoom toolbar */}
      {pairs.length > 0 && viewMode === 'tree' && (
        <div style={{ position: 'absolute', bottom: 72, left: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
          {([
            { title: 'Zoom in',  action: () => setScale(s => Math.min(2, +(s + 0.15).toFixed(2))),    icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> },
            { title: 'Zoom out', action: () => setScale(s => Math.max(0.3, +(s - 0.15).toFixed(2))), icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> },
            { title: 'Fit all',    action: fitView,   icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /></svg> },
            { title: 'Fit active branch', action: fitBranch, icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="1.5" r="1.2" stroke="currentColor" strokeWidth="1.1" /><circle cx="6" cy="6" r="1.2" stroke="currentColor" strokeWidth="1.1" /><circle cx="6" cy="10.5" r="1.2" stroke="currentColor" strokeWidth="1.1" /><line x1="6" y1="2.7" x2="6" y2="4.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><line x1="6" y1="7.2" x2="6" y2="9.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg> },
          ] as const).map(({ title, action, icon }) => (
            <button key={title} onClick={action} title={title}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--modal-bg)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
            >{icon}</button>
          ))}
          {/* Auto-zoom toggle */}
          <button
            onClick={() => setAutoZoom(z => !z)}
            title={autoZoom ? 'Auto-zoom on (click to disable)' : 'Auto-zoom off (click to enable)'}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: autoZoom ? 'var(--accent)' : 'var(--modal-bg)',
              border: `1px solid ${autoZoom ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 7, cursor: 'pointer',
              color: autoZoom ? 'white' : 'var(--text-secondary)',
              boxShadow: 'var(--shadow-sm)', transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 1.8" />
            </svg>
          </button>
        </div>
      )}

      {/* Branch button */}
      {(() => {
        const selPair = pairs.find(p =>
          p.id === selectedNodeId ||
          p.userNode.id === selectedNodeId ||
          (p.aiNode && p.aiNode.id === selectedNodeId)
        )
        const hasSelection = !!selPair
        const preview      = selPair
          ? (selPair.userNode.content.length > 32 ? selPair.userNode.content.slice(0, 32) + '…' : selPair.userNode.content)
          : null

        return (
          <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10, padding: '0 12px' }}>
            <button
              disabled={!hasSelection}
              onClick={async () => {
                if (!selPair) return
                await handleNodeClick(selPair.aiNode?.id ?? selPair.userNode.id)
                chatInputRef?.current?.focus()
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 14px',
                background:  hasSelection ? 'var(--accent)' : 'var(--bg-muted)',
                color:       hasSelection ? 'white' : 'var(--text-muted)',
                border:      'none', borderRadius: 20,
                fontSize:    11, fontWeight: 600,
                cursor:      hasSelection ? 'pointer' : 'not-allowed',
                boxShadow:   hasSelection ? 'var(--shadow-md)' : 'none',
                whiteSpace:  'nowrap', overflow: 'hidden', maxWidth: '100%',
                transition:  'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="2.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                <circle cx="2.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                <circle cx="9.5" cy="6"   r="1.5" stroke="currentColor" strokeWidth="1.1" />
                <path d="M2.5 4v4M2.5 4c0 0 .5 2 3.5 2h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              {hasSelection && preview ? (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Branch from: <span style={{ opacity: 0.85 }}>{preview}</span>
                </span>
              ) : 'Select a node to branch'}
            </button>
          </div>
        )
      })()}

      {/* Colour picker popup */}
      {colorMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: colorMenu.x, top: colorMenu.y, background: 'var(--modal-bg)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '10px 12px', boxShadow: 'var(--shadow-lg)', zIndex: 9999, minWidth: 144 }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Node colour
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {PALETTE.map(p => {
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
