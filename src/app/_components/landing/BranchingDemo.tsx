'use client'

// ─── BranchingDemo ──────────────────────────────────────────────────────────
// The animated "live canvas" surface that lives inside the hero frame:
//  • macOS-style top bar (window pips + filename + LIVE CANVAS indicator)
//  • Left column: chat bubbles appearing in sequence, with a typing cursor on
//    the AI replies and a small "branching from here" pill on the fork point.
//  • Right column: an SVG tree filling in (root → 3 v1 nodes → 2 v2 leaves)
//    with the active branches inked in accent color.
//  • Bottom controls (visible on hover): pause button, time, scrubber.
//  • Top-left "PRODUCT TOUR" pill, bottom-right "Tap for sound" pill.
//
// Runs on a 9-second loop. Honors prefers-reduced-motion: skips animation and
// shows the final state.

import { useEffect, useState } from 'react'
import { Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react'

// ─── Demo data ──────────────────────────────────────────────────────────────

interface DemoMessage {
  type: 'user' | 'ai'
  initials: string
  text: string
  branch?: boolean
}

interface DemoNode {
  id: string
  label: string
  cx: number
  cy: number
  active: boolean
}

interface DemoEdge {
  px: number
  py: number
  nx: number
  ny: number
  active: boolean
  after: number
}

const D_MESSAGES: DemoMessage[] = [
  { type: 'user', initials: 'JA', text: 'Sketch me a launch plan.' },
  { type: 'ai',   initials: 'AI', text: 'Plan v1: a pre-launch seeding phase, a launch-day push, then a post-launch growth loop.' },
  { type: 'user', initials: 'JA', text: 'Make it bolder.', branch: true },
  { type: 'ai',   initials: 'AI', text: 'Plan v2: open with a viral moment — a Product Hunt drop plus 10 creator seeds, then a 30-day push.' },
]

const D_NODES: DemoNode[] = [
  { id: 'root', label: 'Sketch a plan', cx: 150, cy: 42,  active: false },
  { id: 'p1',   label: 'Plan v1',        cx: 62,  cy: 124, active: false },
  { id: 'p2',   label: 'Make bolder',    cx: 150, cy: 124, active: true  },
  { id: 'p3',   label: 'Plan v3',        cx: 238, cy: 124, active: false },
  { id: 'c1',   label: 'Plan v2: viral', cx: 112, cy: 206, active: true  },
  { id: 'c2',   label: 'Plan v2.1',      cx: 200, cy: 206, active: true  },
]

const D_EDGES: DemoEdge[] = [
  { px: 150, py: 42,  nx: 62,  ny: 124, active: false, after: 1 },
  { px: 150, py: 42,  nx: 150, ny: 124, active: true,  after: 2 },
  { px: 150, py: 42,  nx: 238, ny: 124, active: false, after: 3 },
  { px: 150, py: 124, nx: 112, ny: 206, active: true,  after: 4 },
  { px: 150, py: 124, nx: 200, ny: 206, active: true,  after: 5 },
]

// Per-frame delays (ms) used by the animation loop.
const MSG_DELAYS  = [300, 1100, 2700, 3600]
const NODE_DELAYS = [400, 1200, 2800, 3000, 3700, 3800]
const LOOP_AT    = 9000
// Faux video duration shown on the scrubber.
const TOTAL_SEC  = 47

function edgePath(px: number, py: number, nx: number, ny: number): string {
  const mid = (py + ny) / 2
  return `M ${px} ${py + 14} C ${px} ${mid} ${nx} ${mid} ${nx} ${ny - 14}`
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Drives the 9-second loop: tracks how many messages/nodes are visible
// and which message is currently "streaming." The scrubber fill and the
// elapsed-time label run on a pure CSS animation (see .nx-vs-fill and
// .nx-vs-time-elapsed in landing.css) so the React tree only re-renders
// on the four discrete message/node milestones — not on every frame.
function useBranchingDemo() {
  const [msgs, setMsgs]           = useState(0)
  const [nodes, setNodes]         = useState(0)
  const [streaming, setStreaming] = useState<number>(-1)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setMsgs(D_MESSAGES.length)
      setNodes(D_NODES.length)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []

    const run = () => {
      setMsgs(0)
      setNodes(0)
      setStreaming(-1)
      MSG_DELAYS.forEach((d, i) => {
        timers.push(setTimeout(() => {
          setMsgs(i + 1)
          if (D_MESSAGES[i].type === 'ai') {
            setStreaming(i)
            timers.push(setTimeout(() => {
              setStreaming((s) => (s === i ? -1 : s))
            }, 900))
          }
        }, d))
      })
      NODE_DELAYS.forEach((d, i) => {
        timers.push(setTimeout(() => setNodes(i + 1), d))
      })
      timers.push(setTimeout(run, LOOP_AT))
    }

    run()
    return () => timers.forEach(clearTimeout)
  }, [])

  return { msgs, nodes, streaming }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  /** Whether the sound pill shows the muted glyph. */
  muted?: boolean
  /** Click handler for the sound pill. Falls through to the parent (which
   *  opens the modal) so the click anywhere on the surface "plays" the demo. */
  onSoundClick?: (e: React.MouseEvent) => void
  /** Click handler for the bottom-control buttons. Same idea — defer to parent. */
  onControlClick?: (e: React.MouseEvent) => void
  /** Filename shown in the top bar. */
  fileLabel?: string
}

export default function BranchingDemo({
  muted = true,
  onSoundClick,
  onControlClick,
  fileLabel = 'launch-plan.nodea',
}: Props) {
  const { msgs, nodes, streaming } = useBranchingDemo()
  const w = 88, h = 27

  return (
    <div className="nx-vs">
      {/* macOS-style top status bar */}
      <div className="nx-vs-bar">
        <div className="nx-vs-pips">
          <span className="nx-vs-pip" />
          <span className="nx-vs-pip" />
          <span className="nx-vs-pip accent" />
        </div>
        <span className="nx-vs-file">{fileLabel}</span>
        <span className="nx-vs-rec">
          <span className="nx-vs-rec-dot" />
          live canvas
        </span>
      </div>

      <div className="nx-vs-body">
        {/* Chat column */}
        <div className="nx-vs-chat">
          {D_MESSAGES.slice(0, msgs).map((m, i) => (
            <div key={i} className="nx-msg">
              <div className={`nx-avatar ${m.type}`}>{m.initials}</div>
              <div className={`nx-bubble ${m.type}`}>
                {m.text}
                {streaming === i && <span className="nx-cursor" />}
                {m.branch && (
                  <div>
                    <span className="nx-branch-pill">
                      <BranchGlyph />
                      branching from here
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tree column */}
        <div className="nx-vs-tree">
          <svg viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
            {D_EDGES.map((e, i) =>
              nodes > e.after && (
                <path
                  key={i}
                  d={edgePath(e.px, e.py, e.nx, e.ny)}
                  fill="none"
                  stroke={e.active ? 'var(--edge-active)' : 'var(--edge-color)'}
                  strokeWidth="1.6"
                  pathLength="500"
                  strokeDasharray="500"
                  style={{ animation: 'ln-draw-edge .5s ease both' }}
                />
              ),
            )}
            {D_NODES.slice(0, nodes).map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.cx - w / 2}, ${n.cy - h / 2})`}
                style={{
                  animation: 'ln-popin .35s cubic-bezier(0.18,0.89,0.32,1.28) both',
                  transformOrigin: `${w / 2}px ${h / 2}px`,
                }}
              >
                <rect
                  width={w}
                  height={h}
                  rx="7"
                  fill={n.active ? 'var(--accent-bg)' : 'var(--bg-base)'}
                  stroke={n.active ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth="1"
                />
                <text
                  x={w / 2}
                  y={h / 2 + 4}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontFamily="'DM Sans', sans-serif"
                  fontWeight={500}
                  fill={n.active ? 'var(--accent-text)' : 'var(--text-secondary)'}
                >
                  {n.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* "Product tour" badge */}
        <span className="nx-vs-live">
          <span className="nx-vs-live-dot" />
          Product tour
        </span>

        {/* Sound pill */}
        <button
          type="button"
          className="nx-vs-sound"
          onClick={(e) => {
            e.stopPropagation()
            onSoundClick?.(e)
          }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {muted ? 'Tap for sound' : 'Sound on'}
        </button>

        {/* Bottom controls */}
        <div className="nx-vs-controls">
          <button
            type="button"
            className="nx-vs-ctrl-btn"
            onClick={(e) => { e.stopPropagation(); onControlClick?.(e) }}
            aria-label="Pause"
          >
            <Pause size={14} />
          </button>
          <span className="nx-vs-time nx-vs-time-elapsed" aria-hidden="true" />
          <div className="nx-vs-track">
            <div className="nx-vs-fill" />
          </div>
          <span className="nx-vs-time">{fmtTime(TOTAL_SEC)}</span>
          <button
            type="button"
            className="nx-vs-ctrl-btn"
            onClick={(e) => { e.stopPropagation(); onControlClick?.(e) }}
            aria-label="Fullscreen"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// Small inline branch icon (the lucide GitBranch is heavier; this is a
// stripped 10×10 version that matches the prototype's "branching from here"
// pill exactly).
function BranchGlyph() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}
