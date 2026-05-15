'use client'

import { useMemo, useState } from 'react'
import { useApp, computeLayout, truncate, DbNode } from './App'

const NODE_W = 172
const NODE_H = 56

export default function TreePanel() {
  const { allDbNodes, selectedNodeId, handleNodeClick } = useApp()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const positions = useMemo(
    () => computeLayout(allDbNodes, 200, 90),
    [allDbNodes]
  )

  // Build edge list
  const edges = useMemo(
    () => allDbNodes.filter((n) => n.parent_id && positions.has(n.id) && positions.has(n.parent_id!)),
    [allDbNodes, positions]
  )

  // Bounding box for SVG/canvas sizing
  const { canvasW, canvasH, minX } = useMemo(() => {
    if (positions.size === 0) return { canvasW: 0, canvasH: 0, minX: 0 }
    const xs = Array.from(positions.values()).map((p) => p.x)
    const ys = Array.from(positions.values()).map((p) => p.y)
    const mx = Math.min(...xs)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    return {
      canvasW: maxX - mx + NODE_W + 32,
      canvasH: maxY + NODE_H + 40,
      minX: mx,
    }
  }, [positions])

  // Translate so leftmost node starts at x=16
  const tx = (x: number) => x - minX + 16

  function renderEdge(node: DbNode) {
    const src = positions.get(node.parent_id!)!
    const tgt = positions.get(node.id)!

    const x1 = tx(src.x) + NODE_W / 2
    const y1 = src.y + NODE_H
    const x2 = tx(tgt.x) + NODE_W / 2
    const y2 = tgt.y

    const isStraight = Math.abs(x1 - x2) < 2
    const isBranch = !isStraight
    const stroke = isBranch ? 'var(--edge-color)' : 'var(--border-strong)'
    const strokeDash = isBranch ? '4 3' : undefined

    if (isStraight) {
      return (
        <line
          key={`e-${node.id}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )
    }

    // Cubic bezier for branches
    const cy1 = y1 + (y2 - y1) * 0.5
    const cy2 = y1 + (y2 - y1) * 0.5
    return (
      <path
        key={`e-${node.id}`}
        d={`M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`}
        stroke={stroke}
        strokeWidth="1.5"
        strokeDasharray={strokeDash}
        fill="none"
        strokeLinecap="round"
      />
    )
  }

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        background: 'var(--tree-bg)',
        height: '100vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--topbar-bg)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Tree Diagram
        </span>
        <span
          style={{
            marginLeft: 8,
            fontSize: 11,
            background: 'var(--bg-muted)',
            color: 'var(--text-muted)',
            borderRadius: 10,
            padding: '1px 7px',
          }}
        >
          {allDbNodes.length}
        </span>
      </div>

      {/* Tree content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {allDbNodes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: 12,
              textAlign: 'center',
              padding: 20,
            }}
          >
            Nodes will appear here as you chat
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              width: Math.max(canvasW, 248),
              height: canvasH,
            }}
          >
            {/* SVG edges */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'visible',
              }}
              width={Math.max(canvasW, 248)}
              height={canvasH}
            >
              {edges.map((node) => renderEdge(node))}
            </svg>

            {/* Nodes */}
            {allDbNodes.map((node) => {
              const pos = positions.get(node.id)
              if (!pos) return null

              const isActive = node.id === selectedNodeId
              const isHovered = node.id === hoveredId
              const isUser = node.role === 'user'

              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: 'absolute',
                    left: tx(pos.x),
                    top: pos.y,
                    width: NODE_W,
                    height: NODE_H,
                    background: isActive ? 'var(--node-active-bg)' : 'var(--node-bg)',
                    border: `1.5px solid ${isActive ? 'var(--node-active-border)' : isHovered ? 'var(--border-strong)' : 'var(--node-border)'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 10px',
                    boxShadow: isActive ? '0 0 0 3px var(--accent-bg)' : isHovered ? 'var(--shadow-sm)' : 'none',
                    transition: 'border-color 0.12s, box-shadow 0.12s, background 0.12s',
                  }}
                >
                  {/* Doc icon */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>

                  {/* Label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: isActive ? 'var(--accent-text)' : 'var(--text-primary)',
                        fontWeight: isActive ? 500 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {truncate(node.content, 28)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 500,
                          color: isUser ? '#3b82f6' : 'var(--accent-text)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          opacity: 0.8,
                        }}
                      >
                        {isUser ? 'User' : 'AI'}
                      </span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            background: 'var(--accent)',
                            color: '#fff',
                            borderRadius: 4,
                            padding: '0 5px',
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Context menu placeholder */}
                  <button
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '2px 3px',
                      borderRadius: 4,
                      flexShrink: 0,
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.1s',
                    }}
                    title="More options (coming soon)"
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
        )}
      </div>
    </div>
  )
}
