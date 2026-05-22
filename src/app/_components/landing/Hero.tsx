'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GitBranch } from 'lucide-react'

const MESSAGES = [
  { type: 'user', initials: 'JA', text: 'Sketch me a launch plan.' },
  { type: 'ai',   initials: 'AI', text: 'Plan v1: a pre-launch seeding phase, a launch-day push, then a post-launch growth loop.' },
  { type: 'user', initials: 'JA', text: 'Make it bolder.', branch: true },
  { type: 'ai',   initials: 'AI', text: 'Plan v2: open with a viral moment — Product Hunt drop plus 10 creator seeds, then a 30-day push.' },
] as const

// Bézier edge: start at parent bottom-center, end at child top-center
function edgePath(px: number, py: number, nx: number, ny: number) {
  const mid = (py + ny) / 2
  return `M ${px} ${py + 14} C ${px} ${mid} ${nx} ${mid} ${nx} ${ny - 14}`
}

const NODES = [
  { id: 'root', label: 'Sketch a plan',  cx: 150, cy: 40,  active: false },
  { id: 'p1',   label: 'Plan v1',         cx: 60,  cy: 120, active: false },
  { id: 'p2',   label: 'Make bolder',     cx: 150, cy: 120, active: true  },
  { id: 'p3',   label: 'Plan v3',         cx: 240, cy: 120, active: false },
  { id: 'c1',   label: 'Plan v2: viral',  cx: 110, cy: 200, active: true  },
  { id: 'c2',   label: 'Plan v2.1',       cx: 200, cy: 200, active: true  },
]

const EDGES = [
  { px: 150, py: 40,  nx: 60,  ny: 120, active: false, delay: 1 },
  { px: 150, py: 40,  nx: 150, ny: 120, active: true,  delay: 2 },
  { px: 150, py: 40,  nx: 240, ny: 120, active: false, delay: 3 },
  { px: 150, py: 120, nx: 110, ny: 200, active: true,  delay: 4 },
  { px: 150, py: 120, nx: 200, ny: 200, active: true,  delay: 5 },
]

// Shared timeline: nodes pop in ~100ms after the message they belong to
const MSG_DELAYS  = [300,  1100, 2600, 3500] as const
const NODE_DELAYS = [400,  1200, 2700, 2900, 3600, 3700] as const
const LOOP_AT = 9000

export default function Hero() {
  const [visibleMsgs, setVisibleMsgs]   = useState(0)
  const [visibleNodes, setVisibleNodes] = useState(0)
  const [streamingMsg, setStreamingMsg] = useState(-1)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setVisibleMsgs(MESSAGES.length)
      setVisibleNodes(NODES.length)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []

    function run() {
      setVisibleMsgs(0)
      setVisibleNodes(0)
      setStreamingMsg(-1)

      MSG_DELAYS.forEach((delay, i) => {
        timers.push(setTimeout(() => {
          setVisibleMsgs(i + 1)
          if (MESSAGES[i].type === 'ai') {
            setStreamingMsg(i)
            timers.push(setTimeout(() => setStreamingMsg(s => s === i ? -1 : s), 900))
          }
        }, delay))
      })

      NODE_DELAYS.forEach((delay, i) => {
        timers.push(setTimeout(() => setVisibleNodes(i + 1), delay))
      })

      timers.push(setTimeout(run, LOOP_AT))
    }

    run()
    return () => timers.forEach(clearTimeout)
  }, [])

  const w = 86, h = 26

  return (
    <section className="ln-hero">
      <div className="ln-container">
        <h1 className="ln-hero-h1">Stop scrolling.<br />Start <em>branching.</em></h1>

        <p className="ln-hero-sub">
          Free while in beta. Bring your own keys or use ours. No credit card,
          no waitlist — open an account, open a canvas.
        </p>

        <div className="ln-hero-ctas">
          <Link href="/login" className="ln-btn ln-btn-primary ln-btn-lg">
            Create your first canvas
          </Link>
          <a href="#features" className="ln-btn ln-btn-outline ln-btn-lg">
            See the canvas in motion
          </a>
        </div>

        {/* Demo */}
        <div className="ln-demo">
          <div className="ln-demo-header">
            <div className="ln-demo-pips">
              <div className="ln-demo-pip" />
              <div className="ln-demo-pip" />
              <div className="ln-demo-pip accent" />
            </div>
            <span className="ln-demo-file">launch-plan.nodea</span>
            <span className="ln-demo-tool">7 nodes &middot; 2 branches</span>
          </div>

          <div className="ln-demo-body">
            {/* Chat panel */}
            <div className="ln-chat-panel">
              {MESSAGES.slice(0, visibleMsgs).map((m, i) => (
                <div key={i} className={`ln-msg ${m.type}`}>
                  <div className={`ln-avatar ${m.type}`}>{m.initials}</div>
                  <div className={`ln-bubble ${m.type}`}>
                    {m.text}
                    {streamingMsg === i && <span className="ln-streaming-cursor" />}
                    {'branch' in m && m.branch && (
                      <div>
                        <span className="ln-branch-pill">
                          <GitBranch size={9} />
                          branching from here
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Tree panel */}
            <div className="ln-tree-panel">
              <svg viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
                {/* Edges */}
                {EDGES.map((e, i) => {
                  if (visibleNodes <= e.delay) return null
                  return (
                    <path
                      key={i}
                      d={edgePath(e.px, e.py, e.nx, e.ny)}
                      fill="none"
                      stroke={e.active ? 'var(--edge-active)' : 'var(--edge-color)'}
                      strokeWidth="1.5"
                      pathLength="500"
                      strokeDasharray="500"
                      strokeDashoffset="0"
                      style={{ animation: 'ln-draw-edge 0.5s ease both' }}
                    />
                  )
                })}

                {/* Nodes */}
                {NODES.map((n, i) => {
                  if (i >= visibleNodes) return null
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.cx - w / 2}, ${n.cy - h / 2})`}
                      style={{ animation: 'ln-popin 0.35s cubic-bezier(0.18,0.89,0.32,1.28) both', transformOrigin: `${w / 2}px ${h / 2}px` }}
                    >
                      <rect
                        width={w} height={h} rx="7"
                        fill={n.active ? 'var(--accent-bg)' : 'var(--bg-muted)'}
                        stroke={n.active ? 'var(--accent)' : 'var(--border)'}
                        strokeWidth="1"
                      />
                      <text
                        x={w / 2} y={h / 2 + 4}
                        textAnchor="middle"
                        fontSize="10"
                        fontFamily="var(--font-dm-sans, sans-serif)"
                        fill={n.active ? 'var(--accent-text)' : 'var(--text-secondary)'}
                      >
                        {n.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
