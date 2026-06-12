// Pure model layer for Presentation Mode: tree → render-node derivation,
// layout, background palettes, and the document shape that undo/redo tracks.
// No React, no DOM — everything here is unit-testable and shared between the
// on-screen view and the canvas export renderer so the two never drift.

import type { DbNode } from '../App'

// ── Pairs (mirrors TreePanel's buildPairs — kept separate to avoid a module
//    cycle between TreePanel and PresentationMode) ─────────────────────────────
export interface PresPair {
  id:           string
  userNode:     DbNode
  aiNode:       DbNode | null
  parentPairId: string | null
}

export function buildPresPairs(dbNodes: DbNode[]): PresPair[] {
  const nodeMap       = new Map(dbNodes.map(n => [n.id, n]))
  const pairs: PresPair[] = []
  const pairedUserIds = new Set<string>()
  const sorted        = [...dbNodes].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))

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

// ── Text helpers (mirrors TreePanel) ──────────────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','is','it','in','on','at','to','for','of','and','or','but',
  'this','that','what','how','why','can','you','me','i','my','do','be','are',
  'was','with','as','from','have','has','had','will','not','no','so','get',
  'if','then','please','just','let','know','tell','make','use','need',
])

export function presTitle(userPrompt: string): string {
  const clean = userPrompt.replace(/[^\w\s]/g, ' ').toLowerCase()
  const words = clean.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
  if (words.length >= 2) {
    return words.slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  const sentence = userPrompt.split(/[.!?\n]/)[0].trim()
  if (sentence.length <= 50) return sentence
  return sentence.slice(0, 47) + '…'
}

export function presSummary(aiResponse: string): string {
  const stripped = aiResponse
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`[^`]+`/g, m => m.slice(1, -1))
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^\s*[-*+>\d.]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
  const firstSentence = stripped.match(/^[^.!?]+[.!?]/)?.[0]?.trim() ?? stripped
  return firstSentence.length > 120 ? firstSentence.slice(0, 117) + '…' : firstSentence
}

const ATT_MARK_OPEN  = '<<<NODEA_ATT_V1\n'
const ATT_MARK_CLOSE = '\nNODEA_ATT_V1>>>\n'
export function stripAttachmentMarker(content: string): string {
  if (!content.startsWith(ATT_MARK_OPEN)) return content
  const idx = content.indexOf(ATT_MARK_CLOSE, ATT_MARK_OPEN.length)
  return idx < 0 ? content : content.slice(idx + ATT_MARK_CLOSE.length)
}

export function stripMarkdownPlain(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^\s*[-*+>]\s+/gm, '')
    .trim()
}

// ── Layout constants ──────────────────────────────────────────────────────────
export const P_CELL_W     = 300   // horizontal pitch between sibling columns
export const P_NODE_W     = 260   // collapsed node width
export const P_NODE_W_EXP = 320   // expanded node width
export const P_NODE_H     = 96    // collapsed node height
export const P_NODE_H_EXP = 340   // expanded node height (content clipped inside)
export const P_ROW_GAP    = 80    // vertical gap between depth rows
export const CALLOUT_W    = 240   // callout card width
export const CALLOUT_MIN_H = 64

export interface PresLayoutBox { x: number; y: number; w: number; h: number; depth: number }

// Tidy-tree x positions + depth-row y positions. Rows grow to fit the tallest
// node in them (an expanded node pushes the rows below it down instead of
// overlapping its children). Node boxes are centred within their column cell.
export function computePresLayout(
  pairs: PresPair[],
  expanded: Record<string, boolean>,
): Map<string, PresLayoutBox> {
  const childrenMap = new Map<string | null, PresPair[]>()
  for (const pair of pairs) {
    const k = pair.parentPairId
    if (!childrenMap.has(k)) childrenMap.set(k, [])
    childrenMap.get(k)!.push(pair)
  }

  const colX   = new Map<string, number>()
  const depths = new Map<string, number>()
  let leafIdx  = 0
  let maxDepth = 0

  function walk(id: string, depth: number): number {
    depths.set(id, depth)
    maxDepth = Math.max(maxDepth, depth)
    const children = childrenMap.get(id) ?? []
    if (children.length === 0) {
      const x = leafIdx * P_CELL_W
      leafIdx++
      colX.set(id, x)
      return x
    }
    const xs = children.map(c => walk(c.id, depth + 1))
    const x  = (xs[0] + xs[xs.length - 1]) / 2
    colX.set(id, x)
    return x
  }
  for (const pair of childrenMap.get(null) ?? []) walk(pair.id, 0)

  // Row heights: tallest node in each depth row.
  const rowH: number[] = Array.from({ length: maxDepth + 1 }, () => P_NODE_H)
  for (const pair of pairs) {
    const d = depths.get(pair.id)
    if (d === undefined) continue
    if (expanded[pair.id]) rowH[d] = Math.max(rowH[d], P_NODE_H_EXP)
  }
  const rowY: number[] = []
  let acc = 0
  for (let d = 0; d <= maxDepth; d++) { rowY[d] = acc; acc += rowH[d] + P_ROW_GAP }

  const out = new Map<string, PresLayoutBox>()
  for (const pair of pairs) {
    const cx = colX.get(pair.id)
    const d  = depths.get(pair.id)
    if (cx === undefined || d === undefined) continue
    const w = expanded[pair.id] ? P_NODE_W_EXP : P_NODE_W
    const h = expanded[pair.id] ? P_NODE_H_EXP : P_NODE_H
    out.set(pair.id, { x: cx + (P_CELL_W - w) / 2, y: rowY[d], w, h, depth: d })
  }
  return out
}

// The tree path directly connecting two pairs: walks both up to their lowest
// common ancestor and returns a → … → LCA → … → b (inclusive). If the two live
// under different roots there is no connecting path — just the endpoints.
export function pathBetween(pairs: PresPair[], aId: string, bId: string): string[] {
  if (aId === bId) return [aId]
  const parent = new Map(pairs.map(p => [p.id, p.parentPairId]))
  const ancestors = (id: string): string[] => {
    const out: string[] = []
    let cur: string | null | undefined = id
    const guard = new Set<string>()           // cycle guard, just in case
    while (cur != null && !guard.has(cur)) {
      guard.add(cur)
      out.push(cur)
      cur = parent.get(cur) ?? null
    }
    return out
  }
  const aAnc = ancestors(aId)
  const bAnc = ancestors(bId)
  const bIdx = new Map(bAnc.map((id, i) => [id, i]))
  for (let i = 0; i < aAnc.length; i++) {
    const j = bIdx.get(aAnc[i])
    if (j !== undefined) {
      // a → … → LCA, then back down LCA → … → b (LCA included once).
      return [...aAnc.slice(0, i + 1), ...bAnc.slice(0, j).reverse()]
    }
  }
  return [aId, bId]
}

// ── Backgrounds & palettes ────────────────────────────────────────────────────
export type BgId = 'white' | 'dots' | 'gradient' | 'slate' | 'transparent'

export interface PresPalette {
  dark:          boolean
  canvas:        string   // flat fill ('' = transparent; gradient handled per-bg)
  dot:           string   // dot-grid colour ('' = no dots)
  nodeBg:        string
  nodeBorder:    string
  textPrimary:   string
  textSecondary: string
  divider:       string
  edge:          string
  accent:        string
  calloutBg:     string
  calloutBorder: string
}

const LIGHT: Omit<PresPalette, 'canvas' | 'dot'> = {
  dark:          false,
  nodeBg:        '#ffffff',
  nodeBorder:    '#d4d4d8',
  textPrimary:   '#18181b',
  textSecondary: '#52525b',
  divider:       '#e4e4e7',
  edge:          '#a1a1aa',
  accent:        '#7c3aed',
  calloutBg:     '#ffffff',
  calloutBorder: '#e4e4e7',
}

const DARK: Omit<PresPalette, 'canvas' | 'dot'> = {
  dark:          true,
  nodeBg:        '#1e293b',
  nodeBorder:    '#3f4d63',
  textPrimary:   '#f1f5f9',
  textSecondary: '#a5b4c8',
  divider:       '#334155',
  edge:          '#64748b',
  accent:        '#8b5cf6',
  calloutBg:     '#1e293b',
  calloutBorder: '#3f4d63',
}

export interface BgOption {
  id:      BgId
  label:   string
  palette: PresPalette
  // [stop colour, …] for the soft gradient option; empty for flat fills.
  gradientStops: string[]
}

export const BACKGROUNDS: BgOption[] = [
  { id: 'white',       label: 'Clean white', gradientStops: [], palette: { ...LIGHT, canvas: '#ffffff', dot: '' } },
  { id: 'dots',        label: 'Dotted grid', gradientStops: [], palette: { ...LIGHT, canvas: '#fafafa', dot: '#d4d4d8' } },
  { id: 'gradient',    label: 'Soft violet', gradientStops: ['#ede9fe', '#faf5ff', '#ffffff'], palette: { ...LIGHT, canvas: '#f5f3ff', dot: '' } },
  { id: 'slate',       label: 'Dark slate',  gradientStops: [], palette: { ...DARK, canvas: '#0f172a', dot: '#293548' } },
  { id: 'transparent', label: 'Transparent', gradientStops: [], palette: { ...LIGHT, canvas: '', dot: '' } },
]

export function bgOption(id: BgId): BgOption {
  return BACKGROUNDS.find(b => b.id === id) ?? BACKGROUNDS[0]
}

// Node colour palette — same hexes the main tree uses, so colours carry over.
export const PRES_COLORS = [
  { id: 'default', label: 'Default', hex: ''        },
  { id: 'red',     label: 'Red',     hex: '#ef4444' },
  { id: 'orange',  label: 'Orange',  hex: '#f97316' },
  { id: 'yellow',  label: 'Yellow',  hex: '#eab308' },
  { id: 'green',   label: 'Green',   hex: '#22c55e' },
  { id: 'blue',    label: 'Blue',    hex: '#3b82f6' },
  { id: 'indigo',  label: 'Indigo',  hex: '#6366f1' },
  { id: 'violet',  label: 'Violet',  hex: '#8b5cf6' },
]

// ── Document (the undo/redo-tracked state) ────────────────────────────────────
export interface PresCallout {
  id:      string
  text:    string
  x:       number
  y:       number
  nodeIds: string[]   // pairs this callout summarises (connector lines)
  pending: boolean    // true while the AI summary is in flight
}

export interface PresDoc {
  offsets:    Record<string, { dx: number; dy: number }>
  colors:     Record<string, string>     // pair id → hex ('' / absent = default)
  expanded:   Record<string, boolean>
  hidden:     Record<string, boolean>    // greyed out (de-emphasized, still visible)
  callouts:   PresCallout[]
  background: BgId
  showTitle:  boolean
}

export const CALLOUT_MAX = 200
export const HISTORY_CAP = 100

export function makeDefaultDoc(
  pairs: PresPair[],
  appNodeColors: Record<string, string>,
): PresDoc {
  // Seed presentation colours from the colours the user already gave nodes in
  // the main tree (keyed by pair id, user-node id, or ai-node id over there).
  const colors: Record<string, string> = {}
  for (const p of pairs) {
    const c = appNodeColors[p.id] || appNodeColors[p.userNode.id] || (p.aiNode ? appNodeColors[p.aiNode.id] : '') || ''
    if (c) colors[p.id] = c
  }
  return { offsets: {}, colors, expanded: {}, hidden: {}, callouts: [], background: 'white', showTitle: true }
}

const STORAGE_PREFIX = 'nodea_present_'

export function loadDoc(convId: string): Partial<PresDoc> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + convId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PresDoc>
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed
  } catch { return null }
}

export function saveDoc(convId: string, doc: PresDoc): void {
  try { localStorage.setItem(STORAGE_PREFIX + convId, JSON.stringify(doc)) } catch {}
}

export function clearDoc(convId: string): void {
  try { localStorage.removeItem(STORAGE_PREFIX + convId) } catch {}
}

// Merge a stored doc over the defaults, dropping anything that no longer
// resolves (deleted nodes, unknown background ids) so stale state can't break
// the canvas.
export function hydrateDoc(stored: Partial<PresDoc>, fallback: PresDoc, pairs: PresPair[]): PresDoc {
  const ids = new Set(pairs.map(p => p.id))
  const pick = <T,>(rec: Record<string, T> | undefined): Record<string, T> => {
    const out: Record<string, T> = {}
    if (rec && typeof rec === 'object') {
      for (const [k, v] of Object.entries(rec)) if (ids.has(k)) out[k] = v
    }
    return out
  }
  const validBg = BACKGROUNDS.some(b => b.id === stored.background)
  const callouts = Array.isArray(stored.callouts)
    ? stored.callouts
        .filter(c => c && typeof c.text === 'string' && Number.isFinite(c.x) && Number.isFinite(c.y))
        .map(c => ({
          id:      String(c.id ?? `co_${Math.random().toString(36).slice(2)}`),
          text:    c.text.slice(0, CALLOUT_MAX),
          x:       c.x,
          y:       c.y,
          nodeIds: Array.isArray(c.nodeIds) ? c.nodeIds.filter(id => ids.has(id)) : [],
          pending: false, // a pending summary never survives a reload
        }))
    : fallback.callouts
  return {
    offsets:    pick(stored.offsets),
    colors:     { ...fallback.colors, ...pick(stored.colors) },
    expanded:   pick(stored.expanded),
    hidden:     pick(stored.hidden),
    callouts,
    background: validBg ? (stored.background as BgId) : fallback.background,
    showTitle:  typeof stored.showTitle === 'boolean' ? stored.showTitle : fallback.showTitle,
  }
}
