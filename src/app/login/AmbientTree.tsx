'use client'

import { useEffect, useState } from 'react'

const NODES = [
  { id: 'b1', x: 230, y: 40,  role: 'user',      label: 'a question',   at: 0     },
  { id: 'b2', x: 230, y: 120, role: 'assistant',  label: 'first answer', at: 500   },
  { id: 'b3', x: 230, y: 200, role: 'user',       label: 'go deeper',    at: 2000  },
  { id: 'b4', x: 130, y: 280, role: 'assistant',  label: 'branch a',     at: 2800  },
  { id: 'b5', x: 330, y: 280, role: 'assistant',  label: 'branch b',     at: 4200  },
  { id: 'b6', x: 130, y: 360, role: 'user',       label: 'iterate',      at: 6000  },
  { id: 'b7', x: 60,  y: 440, role: 'assistant',  label: 'refined',      at: 6800  },
  { id: 'b8', x: 200, y: 440, role: 'assistant',  label: 'reframed',     at: 8200  },
  { id: 'b9', x: 330, y: 360, role: 'assistant',  label: 'kept',         at: 9600  },
] as const

const EDGES = [
  { from: 'b1', to: 'b2' },
  { from: 'b2', to: 'b3' },
  { from: 'b3', to: 'b4' },
  { from: 'b3', to: 'b5' },
  { from: 'b4', to: 'b6' },
  { from: 'b6', to: 'b7' },
  { from: 'b6', to: 'b8' },
  { from: 'b5', to: 'b9' },
]

const CYCLE = 12000

function nodeWidth(label: string) {
  return Math.max(90, label.length * 7.4 + 18)
}

export default function AmbientTree() {
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setVisible(new Set(NODES.map(n => n.id)))
      setActiveId(null)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []

    function run() {
      setVisible(new Set())
      setActiveId(null)

      NODES.forEach(n => {
        timers.push(setTimeout(() => {
          setVisible(prev => new Set([...prev, n.id]))
          setActiveId(n.id)
        }, n.at))
      })

      // Clear active after last node settles
      timers.push(setTimeout(() => setActiveId(null), 10400))
      // Loop
      timers.push(setTimeout(run, CYCLE))
    }

    run()
    return () => timers.forEach(clearTimeout)
  }, [])

  function getNode(id: string) {
    return NODES.find(n => n.id === id)
  }

  return (
    <svg
      viewBox="0 0 460 500"
      preserveAspectRatio="xMidYMid meet"
      className="au-tree-svg"
    >
      {/* Edges — drawn when both endpoints are visible */}
      {EDGES.map((e, i) => {
        const p = getNode(e.from)
        const n = getNode(e.to)
        if (!p || !n) return null
        if (!visible.has(e.from) || !visible.has(e.to)) return null

        const isActive = activeId === e.to
        const my = (p.y + n.y) / 2

        return (
          <path
            key={i}
            d={`M ${p.x} ${p.y + 16} C ${p.x} ${my}, ${n.x} ${my}, ${n.x} ${n.y - 16}`}
            fill="none"
            stroke={isActive ? 'var(--accent)' : 'var(--edge-color)'}
            strokeWidth={isActive ? 2 : 1.5}
            opacity={isActive ? 1 : 0.6}
            style={{ transition: 'stroke .8s ease, opacity .8s ease' }}
          />
        )
      })}

      {/* Nodes */}
      {NODES.map(n => {
        if (!visible.has(n.id)) return null

        const isActive = activeId === n.id
        const isUser = n.role === 'user'
        const w = nodeWidth(n.label)

        return (
          <g
            key={n.id}
            style={{
              animation: 'au-popin 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) both',
              transformOrigin: `${n.x}px ${n.y}px`,
            }}
          >
            {/* Pulse ring on active node */}
            {isActive && (
              <circle
                cx={n.x}
                cy={n.y}
                r={8}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                opacity="0.55"
                style={{ animation: 'au-ring-pulse 3.6s ease-out infinite' }}
              />
            )}

            <rect
              x={n.x - w / 2}
              y={n.y - 16}
              width={w}
              height={32}
              rx={9}
              fill={
                isActive ? 'var(--accent-bg)' :
                isUser   ? 'var(--user-bubble-bg)' :
                           'var(--bg-muted)'
              }
              stroke={
                isActive ? 'var(--accent)' :
                isUser   ? 'var(--user-bubble-border)' :
                           'var(--border)'
              }
              strokeWidth={isActive ? 1.5 : 1}
              style={{ transition: 'fill .8s ease, stroke .8s ease' }}
            />

            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              fontSize="9.5"
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.04em',
                fill: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                transition: 'fill .8s ease',
              }}
            >
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
