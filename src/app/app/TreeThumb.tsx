'use client'

// ─── TreeThumb — miniature renderer of a conversation tree ───────────────────
// Used as the "shape of the conversation" hint on the project page. Renders a
// real layout (Reingold–Tilford style, same as the full canvas) so the user
// sees something genuine — not a placeholder. Falls back to a depth/spread
// sparkline shape when the real node graph isn't loaded.
//
// The "active path" is the leftmost branch from root to a leaf, mirroring the
// canvas's "oldest branch" highlight.

import { useMemo } from 'react'

export interface MiniNode {
  id: string
  parent: string | null
}

export interface MiniTreeStats {
  count: number
  branches: number
}

export interface MiniTree extends MiniTreeStats {
  nodes: MiniNode[]
}

interface Props {
  tree: MiniTree
  width?: number
  height?: number
  color?: string
}

interface Pos { x: number; y: number }

function layoutTree(tree: MiniTree) {
  const childrenMap = new Map<string | null, string[]>()
  for (const n of tree.nodes) {
    const k = n.parent ?? null
    if (!childrenMap.has(k)) childrenMap.set(k, [])
    childrenMap.get(k)!.push(n.id)
  }

  const pos = new Map<string, Pos>()
  let leaf = 0
  function walk(id: string, depth: number): number {
    const kids = childrenMap.get(id) ?? []
    if (!kids.length) {
      const x = leaf++
      pos.set(id, { x, y: depth })
      return x
    }
    const xs = kids.map((k) => walk(k, depth + 1))
    const x = (xs[0] + xs[xs.length - 1]) / 2
    pos.set(id, { x, y: depth })
    return x
  }
  for (const root of childrenMap.get(null) ?? []) walk(root, 0)

  const xs = Array.from(pos.values()).map((p) => p.x)
  const ys = Array.from(pos.values()).map((p) => p.y)
  return {
    pos,
    maxX: xs.length ? Math.max(...xs) : 0,
    maxY: ys.length ? Math.max(...ys) : 0,
    childrenMap,
  }
}

export default function TreeThumb({ tree, width = 104, height = 60, color = 'var(--accent)' }: Props) {
  const { pos, maxX, maxY, childrenMap } = useMemo(() => layoutTree(tree), [tree])

  const padX = 9, padY = 8
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const sx = maxX > 0 ? innerW / maxX : 0
  const sy = maxY > 0 ? innerH / maxY : 0
  const px = (x: number) => padX + (maxX > 0 ? x * sx : innerW / 2)
  const py = (y: number) => padY + (maxY > 0 ? y * sy : innerH / 2)

  // Active path = leftmost branch from root to a leaf.
  const active = new Set<string>()
  let cur: string | undefined = (childrenMap.get(null) ?? [])[0]
  while (cur !== undefined) {
    active.add(cur)
    cur = (childrenMap.get(cur) ?? [])[0]
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {tree.nodes.map((n) => {
        if (!n.parent) return null
        const a = pos.get(n.parent)
        const b = pos.get(n.id)
        if (!a || !b) return null
        const onPath = active.has(n.id) && active.has(n.parent)
        const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y)
        const my = (y1 + y2) / 2
        return (
          <path
            key={'e' + n.id}
            d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
            fill="none"
            stroke={onPath ? color : 'var(--edge-color)'}
            strokeWidth={onPath ? 1.6 : 1.2}
            strokeLinecap="round"
          />
        )
      })}
      {tree.nodes.map((n) => {
        const p = pos.get(n.id)
        if (!p) return null
        const onPath = active.has(n.id)
        const isRoot = !n.parent
        return (
          <circle
            key={'n' + n.id}
            cx={px(p.x)} cy={py(p.y)}
            r={isRoot ? 3 : 2.4}
            fill={onPath ? color : 'var(--node-bg)'}
            stroke={onPath ? color : 'var(--border-strong)'}
            strokeWidth={1.3}
          />
        )
      })}
    </svg>
  )
}

// Compact stat fallback when the real tree isn't loaded into client state.
export function TreeStat({ stats, color = 'var(--accent)' }: { stats: MiniTreeStats; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 11.5 }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color }}>
        <circle cx="7"  cy="2.4"  r="1.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="3"  cy="11.6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="11" cy="11.6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 3.9v2.6M7 6.5L3.4 10M7 6.5l3.6 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span style={{ whiteSpace: 'nowrap' }}>
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{stats.count}</strong> nodes
        {stats.branches > 0 && (
          <> · <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{stats.branches}</strong>{' '}
            {stats.branches === 1 ? 'branch' : 'branches'}
          </>
        )}
      </span>
    </div>
  )
}
