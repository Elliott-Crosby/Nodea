'use client'

// Presentation Mode: a full-screen, non-destructive view of the conversation
// tree for sharing and exporting. Everything done here (recolouring, moving,
// expanding nodes, callouts, background) is presentation-only state persisted
// to localStorage per conversation — the real tree is never touched.
//
// Interactions:
//  • drag empty canvas = pan, wheel = zoom, Shift+drag = marquee select
//  • click node = select, Shift/Ctrl+click = add to selection
//  • drag node = move it (moves the whole selection if it's part of one)
//  • double-click node = expand to full prompt + answer
//  • arrow keys nudge selection, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y = undo/redo
//  • Esc closes (menus first, then the overlay)

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { track } from '@vercel/analytics'
import { useApp } from '../App'
import {
  BACKGROUNDS, bgOption, buildPresPairs, CALLOUT_MAX, CALLOUT_W, clearDoc,
  computePresLayout, HISTORY_CAP, hydrateDoc, loadDoc, makeDefaultDoc,
  pathBetween, PRES_COLORS, presSummary, presTitle, saveDoc, stripAttachmentMarker,
  stripMarkdownPlain, type PresCallout, type PresDoc,
} from './presentationModel'
import {
  calloutHeight, downloadBlob, exportPdf, exportPng, HIDDEN_ALPHA,
  HIDDEN_EDGE_ALPHA, type ExportScene,
} from './exportRenderer'

const MIN_SCALE = 0.15
const MAX_SCALE = 2.5

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function safeFilename(name: string): string {
  const base = name.trim().replace(/[^\w\d -]+/g, '').replace(/\s+/g, '-').slice(0, 60)
  return base || 'nodea-tree'
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function TbButton({ title, onClick, disabled, active, children }: {
  title: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 30, minWidth: 30, padding: '0 7px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        background: active ? 'var(--accent)' : 'transparent',
        color: disabled ? 'var(--text-muted)' : active ? '#fff' : 'var(--text-secondary)',
        border: 'none', borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
        transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={e => { if (!disabled && !active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PresentationMode({ onClose }: { onClose: () => void }) {
  const { allDbNodes, nodeColors, nodeSummaries, convName, activeConvId } = useApp()

  const pairs = useMemo(() => buildPresPairs(allDbNodes), [allDbNodes])

  // Derived per-pair text content (stable for the session).
  const content = useMemo(() => {
    const m = new Map<string, { title: string; summary: string; prompt: string; answer: string }>()
    for (const p of pairs) {
      const meta = nodeSummaries[p.id]
      const prompt = stripAttachmentMarker(p.userNode.content).trim()
      const answer = p.aiNode ? stripMarkdownPlain(p.aiNode.content) : ''
      m.set(p.id, {
        title:   meta?.title   || presTitle(prompt),
        summary: meta?.summary || (p.aiNode ? presSummary(p.aiNode.content) : ''),
        prompt,
        answer,
      })
    }
    return m
  }, [pairs, nodeSummaries])

  // ── Document + history ───────────────────────────────────────────────────────
  const initialDoc = useMemo(() => {
    const fallback = makeDefaultDoc(pairs, nodeColors)
    if (!activeConvId) return fallback
    const stored = loadDoc(activeConvId)
    return stored ? hydrateDoc(stored, fallback, pairs) : fallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [doc,    setDoc]    = useState<PresDoc>(initialDoc)
  const [past,   setPast]   = useState<PresDoc[]>([])
  const [future, setFuture] = useState<PresDoc[]>([])
  const docRef = useRef(doc)
  docRef.current = doc

  // Snapshot the current doc onto the undo stack (clears redo). Call once per
  // user gesture, BEFORE applying its changes.
  const snapshot = useCallback(() => {
    setPast(p => [...p.slice(-(HISTORY_CAP - 1)), docRef.current])
    setFuture([])
  }, [])

  // One-step change: snapshot + apply.
  const commit = useCallback((fn: (d: PresDoc) => PresDoc) => {
    snapshot()
    setDoc(d => fn(d))
  }, [snapshot])

  const undo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      setFuture(f => [docRef.current, ...f])
      setDoc(prev)
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f
      const next = f[0]
      setPast(p => [...p, docRef.current])
      setDoc(next)
      return f.slice(1)
    })
  }, [])

  // Persist (debounced) so the setup survives close/reopen.
  useEffect(() => {
    if (!activeConvId) return
    const t = setTimeout(() => saveDoc(activeConvId, doc), 300)
    return () => clearTimeout(t)
  }, [doc, activeConvId])

  // Flush on close — without this, changes made <300ms before closing are lost
  // (the debounce timer is cleaned up on unmount before it fires).
  useEffect(() => {
    return () => { if (activeConvId) saveDoc(activeConvId, docRef.current) }
  }, [activeConvId])

  // ── Layout ───────────────────────────────────────────────────────────────────
  const layout = useMemo(() => computePresLayout(pairs, doc.expanded), [pairs, doc.expanded])

  const boxFor = useCallback((pairId: string) => {
    const base = layout.get(pairId)
    if (!base) return null
    const off = doc.offsets[pairId]
    return { ...base, x: base.x + (off?.dx ?? 0), y: base.y + (off?.dy ?? 0) }
  }, [layout, doc.offsets])

  // ── Viewport ─────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan,   setPan]   = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const scaleRef = useRef(scale); scaleRef.current = scale
  const panRef   = useRef(pan);   panRef.current   = pan

  const contentBounds = useCallback(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const p of pairs) {
      const b = boxFor(p.id)
      if (!b) continue
      x0 = Math.min(x0, b.x);       y0 = Math.min(y0, b.y)
      x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h)
    }
    for (const c of docRef.current.callouts) {
      x0 = Math.min(x0, c.x);             y0 = Math.min(y0, c.y)
      x1 = Math.max(x1, c.x + CALLOUT_W); y1 = Math.max(y1, c.y + 80)
    }
    if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 400, y1: 300 }
    return { x0, y0, x1, y1 }
  }, [pairs, boxFor])

  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { x0, y0, x1, y1 } = contentBounds()
    const cw = el.clientWidth, ch = el.clientHeight
    if (cw === 0 || ch === 0) return
    const pad = 80
    const s = Math.max(MIN_SCALE, Math.min((cw - pad * 2) / (x1 - x0), (ch - pad * 2) / (y1 - y0), 1.1))
    setScale(s)
    setPan({ x: (cw - (x1 - x0) * s) / 2 - x0 * s, y: (ch - (y1 - y0) * s) / 2 - y0 * s })
  }, [contentBounds])

  useEffect(() => {
    const t = setTimeout(fitView, 30)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wheel: mouse wheel / pinch zooms at cursor, trackpad scroll pans
  // (same heuristic as the main tree so it feels identical).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function isMouseWheel(e: WheelEvent) {
      if (e.deltaMode !== 0) return true
      return e.deltaX === 0 && Math.abs(e.deltaY) >= 100 && Number.isInteger(e.deltaY)
    }
    function onWheel(e: WheelEvent) {
      if ((e.target as HTMLElement).closest('[data-pres-ui]')) return
      e.preventDefault()
      if (e.ctrlKey || isMouseWheel(e)) {
        const rect  = el!.getBoundingClientRect()
        const mx    = e.clientX - rect.left
        const my    = e.clientY - rect.top
        const f     = e.deltaY < 0 ? 1.1 : 0.91
        const cur   = scaleRef.current
        const next  = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cur * f))
        const ratio = next / cur
        setScale(next)
        setPan(p => ({ x: mx - ratio * (mx - p.x), y: my - ratio * (my - p.y) }))
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Selection ────────────────────────────────────────────────────────────────
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)

  // ── Menus / transient ui ─────────────────────────────────────────────────────
  const [bgMenuOpen,     setBgMenuOpen]     = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [resetConfirm,   setResetConfirm]   = useState(false)
  const [exporting,      setExporting]      = useState<null | 'png' | 'pdf'>(null)
  const [summarizing,    setSummarizing]    = useState(false)
  const [toast,          setToast]          = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const closeMenus = useCallback(() => {
    setBgMenuOpen(false)
    setExportMenuOpen(false)
    setResetConfirm(false)
  }, [])

  // ── Canvas pointer: pan or marquee ───────────────────────────────────────────
  function onCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement
    if (t.closest('[data-pres-node]') || t.closest('[data-pres-callout]') || t.closest('[data-pres-ui]')) return
    closeMenus()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    if (e.shiftKey) {
      // marquee select (canvas-space coords)
      const toCanvas = (cx: number, cy: number) => ({
        x: (cx - rect.left - panRef.current.x) / scaleRef.current,
        y: (cy - rect.top  - panRef.current.y) / scaleRef.current,
      })
      const start = toCanvas(e.clientX, e.clientY)
      setMarquee({ x0: start.x, y0: start.y, x1: start.x, y1: start.y })
      const onMove = (ev: PointerEvent) => {
        const cur = toCanvas(ev.clientX, ev.clientY)
        setMarquee({ x0: start.x, y0: start.y, x1: cur.x, y1: cur.y })
      }
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        const cur = toCanvas(ev.clientX, ev.clientY)
        const mx0 = Math.min(start.x, cur.x), mx1 = Math.max(start.x, cur.x)
        const my0 = Math.min(start.y, cur.y), my1 = Math.max(start.y, cur.y)
        const hit = new Set<string>()
        for (const p of pairs) {
          const b = boxFor(p.id)
          if (!b) continue
          if (b.x < mx1 && b.x + b.w > mx0 && b.y < my1 && b.y + b.h > my0) hit.add(p.id)
        }
        setSelection(prev => {
          const next = new Set(prev)
          for (const id of hit) next.add(id)
          return next
        })
        setMarquee(null)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return
    }

    // pan; click without movement clears the selection
    setPanning(true)
    const sx = e.clientX, sy = e.clientY
    const px = panRef.current.x, py = panRef.current.y
    let moved = false
    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true
      setPan({ x: px + (ev.clientX - sx), y: py + (ev.clientY - sy) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setPanning(false)
      if (!moved) setSelection(new Set())
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── Node pointer: click select / drag move ───────────────────────────────────
  function onNodePointerDown(e: React.PointerEvent, pairId: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    closeMenus()

    const shift    = e.shiftKey
    const additive = shift || e.metaKey || e.ctrlKey
    const sx = e.clientX, sy = e.clientY
    // Which nodes a drag would move: the selection if this node is in it,
    // otherwise just this node.
    const moveIds = selection.has(pairId) ? [...selection] : [pairId]
    const startOffsets = new Map(moveIds.map(id => [id, docRef.current.offsets[id] ?? { dx: 0, dy: 0 }]))
    let dragging = false

    const onMove = (ev: PointerEvent) => {
      const dxScreen = ev.clientX - sx
      const dyScreen = ev.clientY - sy
      if (!dragging && Math.abs(dxScreen) + Math.abs(dyScreen) > 4) {
        dragging = true
        snapshot()
        if (!selection.has(pairId)) setSelection(new Set([pairId]))
      }
      if (!dragging) return
      const dx = dxScreen / scaleRef.current
      const dy = dyScreen / scaleRef.current
      setDoc(d => {
        const offsets = { ...d.offsets }
        for (const id of moveIds) {
          const s0 = startOffsets.get(id)!
          offsets[id] = { dx: s0.dx + dx, dy: s0.dy + dy }
        }
        return { ...d, offsets }
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!dragging) {
        setSelection(prev => {
          if (additive) {
            // Shift+clicking a second node selects the whole path directly
            // connecting the two (through their common ancestor). Ctrl+click
            // stays a plain one-node toggle for cherry-picking.
            if (shift && prev.size === 1 && !prev.has(pairId)) {
              const [anchor] = prev
              return new Set(pathBetween(pairs, anchor, pairId))
            }
            const next = new Set(prev)
            if (next.has(pairId)) next.delete(pairId)
            else next.add(pairId)
            return next
          }
          return new Set([pairId])
        })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function toggleExpand(pairId: string) {
    commit(d => ({ ...d, expanded: { ...d.expanded, [pairId]: !d.expanded[pairId] } }))
  }

  // ── Toolbar actions ──────────────────────────────────────────────────────────
  const applyColor = useCallback((hex: string) => {
    if (selection.size === 0) return
    commit(d => {
      const colors = { ...d.colors }
      for (const id of selection) {
        if (hex) colors[id] = hex
        else delete colors[id]
      }
      return { ...d, colors }
    })
    track('present_color_applied')
  }, [selection, commit])

  const setExpandedFor = useCallback((expand: boolean) => {
    const targets = selection.size > 0 ? [...selection] : pairs.map(p => p.id)
    commit(d => {
      const expanded = { ...d.expanded }
      for (const id of targets) {
        if (expand) expanded[id] = true
        else delete expanded[id]
      }
      return { ...d, expanded }
    })
  }, [selection, pairs, commit])

  // Hide = grey out (de-emphasize), not remove. If everything selected is
  // already hidden the same button unhides.
  const selectionAllHidden = selection.size > 0 && [...selection].every(id => doc.hidden[id])
  const toggleHidden = useCallback(() => {
    if (selection.size === 0) return
    const unhide = [...selection].every(id => docRef.current.hidden[id])
    commit(d => {
      const hidden = { ...d.hidden }
      for (const id of selection) {
        if (unhide) delete hidden[id]
        else hidden[id] = true
      }
      return { ...d, hidden }
    })
    track('present_hide_toggled', { unhide })
  }, [selection, commit])

  const doReset = useCallback(() => {
    if (activeConvId) clearDoc(activeConvId)
    snapshot()
    setDoc(makeDefaultDoc(pairs, nodeColors))
    setSelection(new Set())
    setResetConfirm(false)
    setTimeout(fitView, 30)
    track('present_reset')
  }, [activeConvId, pairs, nodeColors, snapshot, fitView])

  // ── Summarize → callout ──────────────────────────────────────────────────────
  const summarizeSelection = useCallback(async () => {
    if (selection.size === 0 || summarizing) return
    const ids = [...selection].slice(0, 8)
    // Selection bounding box.
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
    for (const id of ids) {
      const b = boxFor(id)
      if (!b) continue
      bx0 = Math.min(bx0, b.x);       by0 = Math.min(by0, b.y)
      bx1 = Math.max(bx1, b.x + b.w); by1 = Math.max(by1, b.y + b.h)
    }
    if (!Number.isFinite(bx1)) return
    // Place the callout in the first free spot around the selection
    // (right → below → above → left), so it doesn't land on a sibling node.
    const estH = 100
    const cy   = (by0 + by1) / 2
    const candidates = [
      { x: bx1 + 56,             y: cy - estH / 2 },
      { x: (bx0 + bx1 - CALLOUT_W) / 2, y: by1 + 48 },
      { x: (bx0 + bx1 - CALLOUT_W) / 2, y: by0 - 48 - estH },
      { x: bx0 - 56 - CALLOUT_W, y: cy - estH / 2 },
    ]
    const allBoxes = pairs.map(p => boxFor(p.id)).filter((b): b is NonNullable<ReturnType<typeof boxFor>> => !!b)
    const existing = docRef.current.callouts
    const collides = (c: { x: number; y: number }) =>
      allBoxes.some(b => c.x < b.x + b.w && c.x + CALLOUT_W > b.x && c.y < b.y + b.h && c.y + estH > b.y) ||
      existing.some(e => c.x < e.x + CALLOUT_W && c.x + CALLOUT_W > e.x && c.y < e.y + estH && c.y + estH > e.y)
    const spot = candidates.find(c => !collides(c)) ?? candidates[0]
    const callout: PresCallout = {
      id:      newId('co'),
      text:    '',
      x:       spot.x,
      y:       spot.y,
      nodeIds: ids,
      pending: true,
    }
    commit(d => ({ ...d, callouts: [...d.callouts, callout] }))
    setSummarizing(true)
    track('present_summarize', { nodes: ids.length })

    try {
      const items = ids.map(id => {
        const c = content.get(id)
        return { prompt: c?.prompt ?? '', answer: c?.answer ?? '' }
      })
      const res = await fetch('/api/presentation/summarize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const { text } = await res.json() as { text: string }
      // Fill the pending callout in place — no history step (the add was one).
      setDoc(d => ({
        ...d,
        callouts: d.callouts.map(c => c.id === callout.id
          ? { ...c, text: String(text ?? '').slice(0, CALLOUT_MAX), pending: false }
          : c),
      }))
    } catch {
      // Drop the placeholder and roll the history entry back off the stack.
      setDoc(d => ({ ...d, callouts: d.callouts.filter(c => c.id !== callout.id) }))
      setPast(p => p.slice(0, -1))
      showToast('Summarize failed — try again')
    } finally {
      setSummarizing(false)
    }
  }, [selection, summarizing, boxFor, pairs, commit, content, showToast])

  const updateCalloutText = useCallback((id: string, text: string) => {
    setDoc(d => ({
      ...d,
      callouts: d.callouts.map(c => c.id === id ? { ...c, text: text.slice(0, CALLOUT_MAX) } : c),
    }))
  }, [])

  const deleteCallout = useCallback((id: string) => {
    commit(d => ({ ...d, callouts: d.callouts.filter(c => c.id !== id) }))
  }, [commit])

  function onCalloutDragStart(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    const co = docRef.current.callouts.find(c => c.id === id)
    if (!co) return
    const sx = e.clientX, sy = e.clientY
    const x0 = co.x, y0 = co.y
    let dragging = false
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) {
        dragging = true
        snapshot()
      }
      if (!dragging) return
      const dx = (ev.clientX - sx) / scaleRef.current
      const dy = (ev.clientY - sy) / scaleRef.current
      setDoc(d => ({
        ...d,
        callouts: d.callouts.map(c => c.id === id ? { ...c, x: x0 + dx, y: y0 + dy } : c),
      }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── Export ───────────────────────────────────────────────────────────────────
  const buildScene = useCallback((): ExportScene => {
    const d = docRef.current
    const nodes = pairs.flatMap(p => {
      // Skip any pair without a computed box/content (e.g. an orphan pair in an
      // imported/merged tree). The edges/callouts paths already guard this way;
      // the un-guarded `boxFor(p.id)!` here made every PNG/PDF export throw.
      const b = boxFor(p.id)
      const c = content.get(p.id)
      if (!b || !c) return []
      return [{
        x: b.x, y: b.y, w: b.w, h: b.h,
        color:    d.colors[p.id] ?? '',
        title:    c.title,
        summary:  c.summary,
        prompt:   c.prompt,
        answer:   c.answer,
        expanded: !!d.expanded[p.id],
        hidden:   !!d.hidden[p.id],
      }]
    })
    const edges = pairs.flatMap(p => {
      if (!p.parentPairId) return []
      const b0 = boxFor(p.parentPairId)
      const b1 = boxFor(p.id)
      if (!b0 || !b1) return []
      return [{
        x1: b0.x + b0.w / 2, y1: b0.y + b0.h, x2: b1.x + b1.w / 2, y2: b1.y,
        faded: !!(d.hidden[p.id] || d.hidden[p.parentPairId]),
      }]
    })
    const callouts = d.callouts.filter(c => !c.pending).map(c => ({
      x: c.x, y: c.y, text: c.text,
      anchors: c.nodeIds
        .map(id => boxFor(id))
        .filter((b): b is NonNullable<ReturnType<typeof boxFor>> => !!b)
        .map(b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })),
    }))
    // Resolve the wordmark font: next/font registers Bricolage under an
    // internal family name exposed via the --font-bricolage CSS variable.
    const wordmarkFont = getComputedStyle(document.body).getPropertyValue('--font-bricolage').trim() || undefined
    return {
      nodes, edges, callouts, bg: d.background,
      title: d.showTitle ? convName : '',
      watermark: d.showWatermark,
      wordmarkFont,
    }
  }, [pairs, boxFor, content, convName])

  const doExport = useCallback(async (kind: 'png' | 'pdf') => {
    if (exporting) return
    setExporting(kind)
    setExportMenuOpen(false)
    try {
      const scene = buildScene()
      // Make sure the wordmark font is actually loaded before the canvas draws
      // it (otherwise the first export falls back to the system font).
      if (scene.watermark && scene.wordmarkFont) {
        try { await document.fonts.load(`500 34px ${scene.wordmarkFont}`, 'Nodea') } catch {}
      }
      const blob  = kind === 'png' ? await exportPng(scene) : await exportPdf(scene)
      downloadBlob(blob, `${safeFilename(convName)}.${kind}`)
      track('present_export', { kind })
    } catch {
      showToast(`Export failed — try a smaller zoom area or fewer expanded nodes`)
    } finally {
      setExporting(null)
    }
  }, [exporting, buildScene, convName, showToast])

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  const nudgeSnapshotArmed = useRef(true)
  useEffect(() => {
    function inTextInput(): boolean {
      const a = document.activeElement
      return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (inTextInput()) { (document.activeElement as HTMLElement).blur(); return }
        if (bgMenuOpen || exportMenuOpen || resetConfirm) { closeMenus(); return }
        onClose()
        return
      }
      if (inTextInput()) return
      const mod = e.ctrlKey || e.metaKey
      // Swallow the app's global shortcuts (node-deletion undo, search) while
      // the overlay is up — undo/redo here must only affect the presentation.
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); undo(); return }
      if ((mod && e.shiftKey && e.key.toLowerCase() === 'z') || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault(); e.stopPropagation(); redo(); return
      }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); return }
      const arrows: Record<string, [number, number]> = {
        ArrowUp: [0, -8], ArrowDown: [0, 8], ArrowLeft: [-8, 0], ArrowRight: [8, 0],
      }
      if (arrows[e.key] && selection.size > 0) {
        e.preventDefault()
        const [dx, dy] = arrows[e.key]
        // First nudge of a burst gets a history snapshot; the burst then
        // coalesces until keys go quiet for half a second.
        if (nudgeSnapshotArmed.current) { snapshot(); nudgeSnapshotArmed.current = false }
        setDoc(d => {
          const offsets = { ...d.offsets }
          for (const id of selection) {
            const o = offsets[id] ?? { dx: 0, dy: 0 }
            offsets[id] = { dx: o.dx + dx, dy: o.dy + dy }
          }
          return { ...d, offsets }
        })
      }
    }
    function onKeyUp() {
      setTimeout(() => { nudgeSnapshotArmed.current = true }, 500)
    }
    // Capture phase: runs before the app's own window-level shortcut listeners,
    // so stopPropagation above actually shields them.
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [bgMenuOpen, exportMenuOpen, resetConfirm, closeMenus, onClose, undo, redo, selection, snapshot])

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────────
  const bg  = bgOption(doc.background)
  const pal = bg.palette

  const canvasBgStyle: React.CSSProperties =
    doc.background === 'gradient'
      ? { background: `linear-gradient(135deg, ${bg.gradientStops.join(', ')})` }
      : doc.background === 'transparent'
      ? {
          backgroundColor: '#ffffff',
          backgroundImage:
            'linear-gradient(45deg, #ececef 25%, transparent 25%, transparent 75%, #ececef 75%), ' +
            'linear-gradient(45deg, #ececef 25%, transparent 25%, transparent 75%, #ececef 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px',
        }
      : pal.dot
      ? {
          backgroundColor: pal.canvas,
          backgroundImage: `radial-gradient(circle, ${pal.dot} 1.2px, transparent 1.2px)`,
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }
      : { backgroundColor: pal.canvas }

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', flexDirection: 'column', background: 'var(--bg-base, #fff)' }}>

      {/* ── Top toolbar ── */}
      <div data-pres-ui="true" style={{
        height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 12px', borderBottom: '1px solid var(--border)', background: 'var(--topbar-bg)',
        position: 'relative', zIndex: 30,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginRight: 8, overflow: 'hidden' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            Presentation
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
            {convName}
          </span>
        </div>

        <Divider />

        {/* Undo / redo / reset */}
        <TbButton title="Undo (Ctrl+Z)" onClick={undo} disabled={past.length === 0}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M5.5 2.5 2.5 5.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.5 5.5h6a3 3 0 0 1 0 6H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </TbButton>
        <TbButton title="Redo (Ctrl+Y)" onClick={redo} disabled={future.length === 0}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ transform: 'scaleX(-1)' }}>
            <path d="M5.5 2.5 2.5 5.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.5 5.5h6a3 3 0 0 1 0 6H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </TbButton>
        <div style={{ position: 'relative' }}>
          <TbButton title="Reset layout, colours & callouts" onClick={() => { closeMenus(); setResetConfirm(r => !r) }}>
            Reset
          </TbButton>
          {resetConfirm && (
            <div data-pres-ui="true" style={{
              position: 'absolute', top: 36, left: 0, width: 220, padding: 12,
              background: 'var(--modal-bg)', border: '1px solid var(--border-strong)',
              borderRadius: 10, boxShadow: 'var(--shadow-lg)', zIndex: 40,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 10 }}>
                Reset the whole setup? Moves, colours, expansions and callouts go back to default. (You can undo this.)
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={doReset} style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--color-error, #dc2626)', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                  Reset
                </button>
                <button onClick={() => setResetConfirm(false)} style={{ flex: 1, padding: '6px 0', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Colour swatches (apply to selection) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, opacity: selection.size > 0 ? 1 : 0.35 }}
          title={selection.size > 0 ? 'Colour selected nodes' : 'Select nodes to colour them'}>
          {PRES_COLORS.map(c => (
            <button
              key={c.id}
              disabled={selection.size === 0}
              onClick={() => applyColor(c.hex)}
              title={c.label}
              style={{
                width: 16, height: 16, borderRadius: '50%', padding: 0,
                background: c.hex || 'var(--bg-muted)',
                border: c.hex ? `1px solid ${c.hex}88` : '1px solid var(--border-strong)',
                cursor: selection.size > 0 ? 'pointer' : 'default',
              }}
            />
          ))}
        </div>

        <Divider />

        {/* Expand / collapse */}
        <TbButton
          title={selection.size > 0 ? 'Expand selected to full prompt + answer (double-click does this too)' : 'Expand all nodes to full prompt + answer'}
          onClick={() => setExpandedFor(true)}
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M7 1h4v4M11 1 7 5M5 11H1V7M1 11l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </TbButton>
        <TbButton
          title={selection.size > 0 ? 'Collapse selected back to summaries' : 'Collapse all nodes back to summaries'}
          onClick={() => setExpandedFor(false)}
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M11 5H7V1M7 5l4-4M1 7h4v4M5 7l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </TbButton>
        <TbButton
          title={selection.size === 0
            ? 'Select nodes to hide them (greyed out, still visible)'
            : selectionAllHidden ? 'Unhide selected nodes' : 'Hide selected nodes (greyed out, still visible)'}
          onClick={toggleHidden}
          disabled={selection.size === 0}
        >
          {selectionAllHidden ? (
            /* eye — unhide */
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 7s2-3.5 5.5-3.5S12.5 7 12.5 7s-2 3.5-5.5 3.5S1.5 7 1.5 7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <circle cx="7" cy="7" r="1.7" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          ) : (
            /* eye with slash — hide */
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 7s2-3.5 5.5-3.5S12.5 7 12.5 7s-2 3.5-5.5 3.5S1.5 7 1.5 7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <circle cx="7" cy="7" r="1.7" stroke="currentColor" strokeWidth="1.2" />
              <line x1="2.5" y1="12" x2="11.5" y2="2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        </TbButton>

        <Divider />

        {/* Summarize */}
        <TbButton
          title={selection.size === 0
            ? 'Select one or more nodes, then summarize them into a callout'
            : `Summarize ${selection.size} node${selection.size > 1 ? 's' : ''} into a callout`}
          onClick={summarizeSelection}
          disabled={selection.size === 0 || summarizing}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.2 3L10 5.2 7.2 6.4 6 9.5 4.8 6.4 2 5.2 4.8 4z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="M10 8.4l.5 1.2 1.1.5-1.1.5-.5 1.2-.5-1.2-1.1-.5 1.1-.5z" fill="currentColor" />
          </svg>
          {summarizing ? 'Summarizing…' : 'Summarize'}
        </TbButton>

        <Divider />

        {/* Background picker */}
        <div style={{ position: 'relative' }}>
          <TbButton title="Background" onClick={() => { const open = bgMenuOpen; closeMenus(); setBgMenuOpen(!open) }} active={bgMenuOpen}>
            <span style={{
              width: 12, height: 12, borderRadius: 3, flexShrink: 0,
              border: '1px solid var(--border-strong)',
              background: doc.background === 'gradient'
                ? `linear-gradient(135deg, ${bg.gradientStops.join(', ')})`
                : doc.background === 'transparent' ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 0 / 8px 8px'
                : pal.canvas,
            }} />
            Background
          </TbButton>
          {bgMenuOpen && (
            <div data-pres-ui="true" style={{
              position: 'absolute', top: 36, left: 0, width: 180, padding: 6,
              background: 'var(--modal-bg)', border: '1px solid var(--border-strong)',
              borderRadius: 10, boxShadow: 'var(--shadow-lg)', zIndex: 40,
            }}>
              {BACKGROUNDS.map(b => (
                <button
                  key={b.id}
                  onClick={() => { commit(d => ({ ...d, background: b.id })); setBgMenuOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '6px 8px', border: 'none', borderRadius: 7,
                    background: doc.background === b.id ? 'var(--bg-muted)' : 'transparent',
                    color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: '1px solid var(--border-strong)',
                    background: b.id === 'gradient'
                      ? `linear-gradient(135deg, ${b.gradientStops.join(', ')})`
                      : b.id === 'transparent' ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 0 / 9px 9px'
                      : b.palette.canvas,
                  }} />
                  {b.label}
                  {b.id === 'transparent' && <span style={{ fontSize: 9.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>PNG only</span>}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={doc.showTitle}
                  onChange={e => commit(d => ({ ...d, showTitle: e.target.checked }))}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Show title on export
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={doc.showWatermark}
                  onChange={e => commit(d => ({ ...d, showWatermark: e.target.checked }))}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Nodea watermark on export
              </label>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 8 }} />

        {/* Export */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { const open = exportMenuOpen; closeMenus(); setExportMenuOpen(!open) }}
            disabled={!!exporting}
            style={{
              height: 32, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: exporting ? 'wait' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3 5.5 6 8.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 10.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {exporting ? `Exporting ${exporting.toUpperCase()}…` : 'Export'}
          </button>
          {exportMenuOpen && (
            <div data-pres-ui="true" style={{
              position: 'absolute', top: 38, right: 0, width: 200, padding: 6,
              background: 'var(--modal-bg)', border: '1px solid var(--border-strong)',
              borderRadius: 10, boxShadow: 'var(--shadow-lg)', zIndex: 40,
            }}>
              {([
                { kind: 'png' as const, label: 'Download PNG', sub: doc.background === 'transparent' ? 'transparent, 2× resolution' : '2× resolution' },
                { kind: 'pdf' as const, label: 'Download PDF', sub: 'single page, sized to tree' },
              ]).map(o => (
                <button
                  key={o.kind}
                  onClick={() => void doExport(o.kind)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%',
                    padding: '7px 9px', border: 'none', borderRadius: 7, background: 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{o.label}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{o.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <TbButton title="Close (Esc)" onClick={onClose}>
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </TbButton>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        onPointerDown={onCanvasPointerDown}
        style={{
          flex: 1, overflow: 'hidden', position: 'relative',
          cursor: panning ? 'grabbing' : 'grab',
          ...canvasBgStyle,
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0,
          transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          userSelect: 'none',
        }}>
          {/* Edges + callout connectors */}
          <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width={1} height={1}>
            {pairs.map(p => {
              if (!p.parentPairId) return null
              const b0 = boxFor(p.parentPairId)
              const b1 = boxFor(p.id)
              if (!b0 || !b1) return null
              const faded = !!(doc.hidden[p.id] || doc.hidden[p.parentPairId])
              const op = faded ? HIDDEN_EDGE_ALPHA : 1
              const x1 = b0.x + b0.w / 2, y1 = b0.y + b0.h
              const x2 = b1.x + b1.w / 2, y2 = b1.y
              const my = (y1 + y2) / 2
              return Math.abs(x1 - x2) < 2
                ? <line key={`e-${p.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={pal.edge} strokeWidth={1.5} strokeLinecap="round" opacity={op} />
                : <path key={`e-${p.id}`} d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`} stroke={pal.edge} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={op} />
            })}
            {doc.callouts.map(c => {
              const h  = calloutHeight(c.text)
              const cx = c.x + CALLOUT_W / 2
              const cy = c.y + h / 2
              return c.nodeIds.map(nid => {
                const b = boxFor(nid)
                if (!b) return null
                const op = doc.hidden[nid] ? HIDDEN_EDGE_ALPHA : 0.65
                const ax = b.x + b.w / 2, ay = b.y + b.h / 2
                const mx = (cx + ax) / 2
                return (
                  <g key={`cl-${c.id}-${nid}`}>
                    <path d={`M${cx},${cy} C${mx},${cy} ${mx},${ay} ${ax},${ay}`} stroke={pal.accent} strokeWidth={1.5} strokeDasharray="5 4" fill="none" opacity={op} />
                    <circle cx={ax} cy={ay} r={3.2} fill={pal.accent} opacity={op} />
                  </g>
                )
              })
            })}
          </svg>

          {/* Nodes */}
          {pairs.map(p => {
            const b = boxFor(p.id)
            if (!b) return null
            const c        = content.get(p.id)!
            const color    = doc.colors[p.id] ?? ''
            const expanded = !!doc.expanded[p.id]
            const selected = selection.has(p.id)
            const hidden   = !!doc.hidden[p.id]
            return (
              <div
                key={p.id}
                data-pres-node="true"
                onPointerDown={e => onNodePointerDown(e, p.id)}
                onDoubleClick={e => { e.stopPropagation(); toggleExpand(p.id) }}
                style={{
                  position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h,
                  opacity: hidden ? HIDDEN_ALPHA : 1,
                  transition: 'opacity 0.15s',
                  background: pal.nodeBg,
                  borderRadius: 10,
                  border: `1.5px solid ${color || pal.nodeBorder}`,
                  boxShadow: selected
                    ? `0 0 0 2.5px ${pal.accent}, 0 4px 10px rgba(0,0,0,${pal.dark ? 0.45 : 0.12})`
                    : `0 2px 10px rgba(0,0,0,${pal.dark ? 0.4 : 0.09})`,
                  cursor: 'move',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              >
                {/* colour tint layer (matches export renderer) */}
                {color && <div style={{ position: 'absolute', inset: 0, background: color + (pal.dark ? '2e' : '1a'), pointerEvents: 'none' }} />}

                {!expanded ? (
                  <div style={{ position: 'relative', padding: '12px 14px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: pal.textPrimary, lineHeight: 1.3,
                      overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, wordBreak: 'break-word',
                    }}>
                      {c.title}
                    </div>
                    {c.summary && (
                      <div style={{
                        fontSize: 11, color: pal.textSecondary, lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, wordBreak: 'break-word',
                      }}>
                        {c.summary}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative', padding: '12px 14px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                      flexShrink: 0,
                      fontSize: 12, fontWeight: 600, color: pal.textPrimary, lineHeight: 1.4,
                      overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 7,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {c.prompt || '(empty)'}
                    </div>
                    {c.answer && (
                      <>
                        <div style={{ borderTop: `1px dashed ${pal.divider}`, flexShrink: 0 }} />
                        <div style={{
                          flex: 1, minHeight: 0,
                          fontSize: 11.5, color: pal.textSecondary, lineHeight: 1.42,
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {c.answer}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Callouts */}
          {doc.callouts.map(co => (
            <CalloutCard
              key={co.id}
              callout={co}
              pal={pal}
              onDragStart={e => onCalloutDragStart(e, co.id)}
              onChange={text => updateCalloutText(co.id, text)}
              onCommitEdit={snapshot}
              onDelete={() => deleteCallout(co.id)}
            />
          ))}

          {/* Marquee */}
          {marquee && (
            <div style={{
              position: 'absolute',
              left:   Math.min(marquee.x0, marquee.x1),
              top:    Math.min(marquee.y0, marquee.y1),
              width:  Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
              background: `${pal.accent}14`,
              border: `1px solid ${pal.accent}`,
              borderRadius: 3,
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Zoom controls */}
        <div data-pres-ui="true" style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 20 }}>
          {([
            { title: 'Zoom in',  action: () => setScale(s => Math.min(MAX_SCALE, +(s + 0.15).toFixed(2))), icon: <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> },
            { title: 'Zoom out', action: () => setScale(s => Math.max(MIN_SCALE, +(s - 0.15).toFixed(2))), icon: <path d="M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> },
            { title: 'Fit tree', action: fitView, icon: <><rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /><rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" /></> },
          ] as const).map(({ title, action, icon }) => (
            <button key={title} onClick={action} title={title}
              style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">{icon}</svg>
            </button>
          ))}
        </div>

        {/* Status / hint pill */}
        <div data-pres-ui="true" style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          padding: '5px 13px', borderRadius: 16, fontSize: 11, fontWeight: 500,
          background: pal.dark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${pal.dark ? '#334155' : '#e4e4e7'}`,
          color: pal.dark ? '#a5b4c8' : '#52525b',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20,
        }}>
          {selection.size > 0
            ? `${selection.size} node${selection.size > 1 ? 's' : ''} selected — drag to move · double-click to expand · Summarize makes a callout`
            : 'Click to select · Shift+click a 2nd node to select the path between · Shift+drag to box-select · double-click to expand'}
        </div>

        {/* Toast */}
        {toast && (
          <div data-pres-ui="true" style={{
            position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
            padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            background: 'var(--text-primary)', color: 'var(--bg-base, #fff)',
            boxShadow: 'var(--shadow-lg)', zIndex: 30, whiteSpace: 'nowrap',
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

// ── Callout card ──────────────────────────────────────────────────────────────
function CalloutCard({ callout, pal, onDragStart, onChange, onCommitEdit, onDelete }: {
  callout:      PresCallout
  pal:          ReturnType<typeof bgOption>['palette']
  onDragStart:  (e: React.PointerEvent) => void
  onChange:     (text: string) => void
  onCommitEdit: () => void
  onDelete:     () => void
}) {
  const [hover,   setHover]   = useState(false)
  const [editing, setEditing] = useState(false)
  const h = calloutHeight(callout.text)

  return (
    <div
      data-pres-callout="true"
      onPointerDown={onDragStart}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute', left: callout.x, top: callout.y, width: CALLOUT_W, minHeight: h,
        background: pal.calloutBg,
        border: `1px solid ${pal.calloutBorder}`,
        borderRadius: 9,
        boxShadow: `0 3px 12px rgba(0,0,0,${pal.dark ? 0.45 : 0.12})`,
        cursor: 'move',
        boxSizing: 'border-box',
        padding: '12px 12px 10px 16px',
      }}
    >
      {/* accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3.5, borderRadius: 2, background: pal.accent }} />

      {/* delete × */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete callout"
        style={{
          position: 'absolute', top: 4, right: 4, width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: pal.textSecondary, opacity: hover ? 0.9 : 0, transition: 'opacity 0.12s',
          padding: 0,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1 1l7 7M8 1 1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {callout.pending ? (
        <div style={{ fontSize: 12, color: pal.textSecondary, fontStyle: 'italic', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${pal.accent}33`, borderTopColor: pal.accent,
            animation: 'nodea-pres-spin 0.7s linear infinite',
          }} />
          Summarizing…
          <style>{`@keyframes nodea-pres-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : (
        <>
          <textarea
            value={callout.text}
            maxLength={CALLOUT_MAX}
            placeholder="Callout…"
            onFocus={() => { setEditing(true); onCommitEdit() }}
            onBlur={() => setEditing(false)}
            onChange={e => onChange(e.target.value)}
            onPointerDown={e => e.stopPropagation()}
            rows={Math.max(2, Math.ceil((callout.text.length || 1) / 34))}
            style={{
              width: '100%', border: 'none', outline: 'none', background: 'transparent',
              resize: 'none', padding: 0, margin: 0,
              fontSize: 12, lineHeight: 1.5, color: pal.textPrimary,
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            fontSize: 9.5, color: pal.textSecondary, textAlign: 'right', marginTop: 2,
            opacity: editing || hover ? 0.8 : 0, transition: 'opacity 0.12s',
          }}>
            {callout.text.length}/{CALLOUT_MAX}
          </div>
        </>
      )}
    </div>
  )
}
