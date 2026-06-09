// Nodea Mobile — normalized tree model + helpers.
// Both /app (DbNode) and /demo (DemoNode) convert their data into this shared
// MNode shape so the mobile tree, pair-cards, and thumbnails work the same way.
// Ported from the design bundle's data.jsx (the heuristics mirror the product).

export interface MNode {
  id: string
  parent: string | null
  role: 'user' | 'assistant'
  text: string
  color?: string | null
  ts: number
  title?: string
  summary?: string
}

export interface Pair {
  id: string
  userNode: MNode
  aiNode: MNode | null
  parentPairId: string | null
  color?: string | null
}

// ── children map ─────────────────────────────────────────────
export function childrenOf(nodes: MNode[]): Map<string | null, MNode[]> {
  const m = new Map<string | null, MNode[]>()
  for (const n of nodes) {
    const k = n.parent
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(n)
  }
  return m
}

// ── path root→tip: up to id, then down newest children ───────
export function pathTo(nodes: MNode[], id: string | null): MNode[] {
  if (!id) return []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const up: MNode[] = []
  let cur = byId.get(id)
  while (cur) {
    up.unshift(cur)
    cur = cur.parent ? byId.get(cur.parent) : undefined
  }
  const ch = childrenOf(nodes)
  const down: MNode[] = []
  let tip = id
  while (true) {
    const k = ch.get(tip) || []
    if (!k.length) break
    const nx = k[k.length - 1]
    down.push(nx)
    tip = nx.id
  }
  return [...up, ...down]
}

// ── title / summary generation (mirrors product heuristics) ──
const STOP = new Set(['a','an','the','is','it','in','on','at','to','for','of','and','or','but','this','that','what','how','why','can','you','me','i','my','do','be','are','was','with','as','from','have','has','had','will','not','no','so','get','if','then','please','just','let','know','tell','make','use','need','more','go','two','option','options'])

export function generateTitle(prompt: string): string {
  const clean = prompt.replace(/[^\w\s]/g, ' ').toLowerCase()
  const words = clean.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
  if (words.length >= 2) return words.slice(0, 4).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
  const s = prompt.split(/[.!?\n]/)[0].trim()
  return s.length <= 38 ? s : s.slice(0, 35) + '…'
}

export function stripMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*+>]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}

export function generateSummary(reply: string): string {
  if (!reply) return ''
  const stripped = stripMd(reply)
  const first = stripped.match(/^[^.!?]+[.!?]/)?.[0]?.trim() ?? stripped
  return first.length > 92 ? first.slice(0, 89) + '…' : first
}

// ── pair model for the tree ──────────────────────────────────
export function buildPairs(nodes: MNode[]): Pair[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const pairs: Pair[] = []
  const pairedUser = new Set<string>()
  for (const n of nodes) {
    if (n.role !== 'assistant') continue
    const up = n.parent ? byId.get(n.parent) : null
    if (!up || up.role !== 'user') continue
    pairedUser.add(up.id)
    let parentPairId: string | null = null
    const gp = up.parent ? byId.get(up.parent) : null
    if (gp && gp.role === 'assistant') parentPairId = gp.id
    pairs.push({ id: n.id, userNode: up, aiNode: n, parentPairId, color: n.color || up.color })
  }
  for (const n of nodes) {
    if (n.role !== 'user' || pairedUser.has(n.id)) continue
    let parentPairId: string | null = null
    const p = n.parent ? byId.get(n.parent) : null
    if (p && p.role === 'assistant') parentPairId = p.id
    pairs.push({ id: n.id, userNode: n, aiNode: null, parentPairId, color: n.color })
  }
  return pairs
}

export function pairChildren(pairs: Pair[]): Map<string | null, Pair[]> {
  const m = new Map<string | null, Pair[]>()
  for (const p of pairs) {
    const k = p.parentPairId
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(p)
  }
  return m
}

export function computePairLayout(pairs: Pair[], hSpacing: number, vSpacing: number): Map<string, { x: number; y: number }> {
  const ch = pairChildren(pairs)
  const pos = new Map<string, { x: number; y: number }>()
  let leaf = 0
  function walk(id: string, depth: number): number {
    const kids = ch.get(id) || []
    if (!kids.length) {
      const x = leaf * hSpacing
      leaf++
      pos.set(id, { x, y: depth * vSpacing })
      return x
    }
    const xs = kids.map((c) => walk(c.id, depth + 1))
    const x = (xs[0] + xs[xs.length - 1]) / 2
    pos.set(id, { x, y: depth * vSpacing })
    return x
  }
  for (const r of (ch.get(null) || [])) walk(r.id, 0)
  return pos
}

export function activePairIds(pairs: Pair[], selectedId: string | null): Set<string> {
  if (!selectedId) return new Set()
  const sel = pairs.find((p) => p.id === selectedId || p.userNode.id === selectedId || (p.aiNode && p.aiNode.id === selectedId))
  if (!sel) return new Set()
  const map = new Map(pairs.map((p) => [p.id, p]))
  const out = new Set<string>()
  let cur: Pair | undefined = sel
  while (cur) {
    out.add(cur.id)
    cur = cur.parentPairId ? map.get(cur.parentPairId) : undefined
  }
  return out
}

export function deepestTip(nodes: MNode[], id: string): string {
  const ch = childrenOf(nodes)
  let tip = id
  while (true) {
    const k = ch.get(tip) || []
    if (!k.length) break
    tip = k[k.length - 1].id
  }
  return tip
}

// pair count + branch count for a node list (for thumbs / stats)
export function treeStats(nodes: MNode[]): { count: number; branches: number } {
  const pairs = buildPairs(nodes)
  const ch = pairChildren(pairs)
  let branches = 0
  for (const [p, kids] of ch) if (p !== null && kids.length > 1) branches++
  return { count: pairs.length, branches }
}

// ── relative-time formatter (drawer / project rows) ──────────
export function fmtRelative(ts: number | null): string {
  if (!ts) return 'No activity yet'
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 1) return 'Just now'
  if (m < 60) return m + 'm ago'
  if (h < 24) return h + 'h ago'
  if (d < 7) return d + 'd ago'
  if (d < 30) return Math.floor(d / 7) + 'w ago'
  return new Date(ts).toLocaleDateString()
}

export function fmtTime(ts: number | null | undefined): string {
  return ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}
