'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@vercel/analytics'
import { Play, X, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import DemoTree from './DemoTree'
import {
  SEED_NODES,
  SEED_META,
  SEED_COLORS,
  DEMO_STICKIES,
  DEMO_INITIAL_SELECTED,
  DEMO_MESSAGE_LIMIT,
  DEMO_CHAR_LIMIT,
  type DemoNode,
  type NodeMeta,
} from './demoSeed'
import './demo.css'

// ── Minimal inline markdown for chat bubbles (**bold**, *italic*) ────────────────
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[2] != null) out.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>)
    else if (m[3] != null) out.push(<em key={`${keyBase}-i${i}`}>{m[3]}</em>)
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// Render short replies: groups of "- " lines become a bullet list; everything
// else is paragraphs. Enough for the seed + the model's brief answers.
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []
  let key = 0

  const flush = () => {
    if (!bullets.length) return
    const items = bullets
    blocks.push(
      <ul key={`ul${key++}`} className="demo-md-ul">
        {items.map((b, i) => (
          <li key={i}>{renderInline(b, `li${key}-${i}`)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (/^[-*]\s+/.test(t)) {
      bullets.push(t.replace(/^[-*]\s+/, ''))
    } else if (t.length === 0) {
      flush()
    } else {
      flush()
      blocks.push(
        <p key={`p${key++}`} className="demo-md-p">
          {renderInline(t, `p${key}`)}
        </p>,
      )
    }
  }
  flush()
  return <>{blocks}</>
}

// Walk parent links from `id` up to the root, returning root→id order.
function pathTo(nodes: DemoNode[], id: string | null): DemoNode[] {
  if (!id) return []
  const map = new Map(nodes.map((n) => [n.id, n]))
  const chain: DemoNode[] = []
  let cur = map.get(id) ?? null
  while (cur) {
    chain.push(cur)
    cur = cur.parent_id ? map.get(cur.parent_id) ?? null : null
  }
  return chain.reverse()
}

function makeTitle(prompt: string): string {
  const s = prompt.split(/[.!?\n]/)[0].trim()
  return s.length <= 42 ? s : s.slice(0, 41) + '…'
}
function makeSummary(reply: string): string {
  const s = reply
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*+>]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
  return s.length <= 80 ? s : s.slice(0, 79) + '…'
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

// Same product video as the landing page's "Watch demo".
const DEMO_VIDEO_ID = 'QJrIkAfZxrE'
const DEMO_VIDEO_SRC =
  `https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}` +
  `?autoplay=1&rel=0&modestbranding=1&playsinline=1&vq=hd1080&hd=1`

const WALL_BENEFITS = [
  'Smarter models — Sonnet & Opus',
  'Full-length, in-depth answers',
  'Save your canvases & projects',
  'Far more messages each day',
  'Upload files, images & PDFs',
]

export default function DemoApp() {
  const { theme, toggleTheme } = useTheme()
  const [nodes, setNodes]           = useState<DemoNode[]>(SEED_NODES)
  const [meta, setMeta]             = useState<Record<string, NodeMeta>>(SEED_META)
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_INITIAL_SELECTED)
  const [input, setInput]           = useState('')
  const [isStreaming, setStreaming] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [sentCount, setSentCount]   = useState(0)
  const [showWall, setShowWall]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showVideo, setShowVideo]   = useState(false)

  const idRef       = useRef(1000)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const atLimit = sentCount >= DEMO_MESSAGE_LIMIT
  const remaining = Math.max(0, DEMO_MESSAGE_LIMIT - sentCount)
  const canSend = !isStreaming && input.trim().length > 0

  // Messages shown in the chat panel: the path from root to the selected node.
  const thread = useMemo(() => pathTo(nodes, selectedId), [nodes, selectedId])

  // Keep the chat panel pinned to the latest message as it streams in.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread, isStreaming])

  // Close the video popup on Esc; lock background scroll while it's open.
  useEffect(() => {
    if (!showVideo) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowVideo(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [showVideo])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setError(null)
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    if (atLimit) {
      setShowWall(true)
      return
    }

    const parentId = selectedId
    const userId   = `u${idRef.current++}`
    const aiId     = `a${idRef.current++}`
    const now      = Date.now()

    const userNode: DemoNode = {
      id: userId,
      parent_id: parentId,
      role: 'user',
      content: text,
      created_at: new Date(now).toISOString(),
    }
    const aiNode: DemoNode = {
      id: aiId,
      parent_id: userId,
      role: 'assistant',
      content: '',
      created_at: new Date(now + 1).toISOString(),
    }

    // Context to send = the selected path + this new prompt (not the empty reply).
    const history    = pathTo(nodes, parentId)
    const apiMessages = [...history, userNode].map((m) => ({ role: m.role, content: m.content }))

    const turnNumber = sentCount + 1
    setNodes((prev) => [...prev, userNode, aiNode])
    setSelectedId(aiId)
    setStreamingId(aiId)
    setStreaming(true)
    setSentCount(turnNumber)
    setInput('')
    setError(null)
    track('demo_message_sent', { turn: turnNumber })

    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok || !res.body) {
        const msg =
          res.status === 429
            ? 'The demo is busy right now — give it a minute and try again.'
            : 'Something went wrong. Please try again.'
        throw new Error(msg)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const visible = full
        setNodes((prev) => prev.map((n) => (n.id === aiId ? { ...n, content: visible } : n)))
      }

      if (!full.trim()) throw new Error('No response. Please try again.')

      setMeta((prev) => ({ ...prev, [aiId]: { title: makeTitle(text), summary: makeSummary(full) } }))

      // The turn that hits the cap reveals the wall once its reply has landed.
      if (turnNumber >= DEMO_MESSAGE_LIMIT) {
        track('demo_limit_reached')
        setTimeout(() => setShowWall(true), 800)
      }
    } catch (err) {
      // Roll back the failed turn: drop the empty reply + the user node, refund
      // the message, and re-select where they were so they can retry.
      setNodes((prev) => prev.filter((n) => n.id !== aiId && n.id !== userId))
      setSelectedId(parentId)
      setSentCount((c) => Math.max(0, c - 1))
      setInput(text)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setStreaming(false)
      setStreamingId(null)
    }
  }, [input, isStreaming, atLimit, selectedId, nodes, sentCount])

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null
  const ghostParentId = selectedNode
    ? selectedNode.role === 'assistant'
      ? selectedNode.id
      : selectedNode.parent_id
    : null

  return (
    <div className="demo-root">
      {/* ── Heading bar (same as the site nav, with Demo highlighted) ── */}
      <header className="demo-nav">
        <div className="demo-nav-left">
          <Link href="/" className="demo-wordmark">Nodea</Link>
          <ul className="demo-nav-links">
            <li><Link href="/what-is-nodea">What is Nodea</Link></li>
            <li><a href="/#how-it-works">How it works</a></li>
            <li><a href="/#features">Features</a></li>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/upgrade">Pricing</Link></li>
            <li><Link href="/demo" className="demo-nav-active" aria-current="page">Demo</Link></li>
          </ul>
        </div>
        <div className="demo-nav-actions">
          <button type="button" className="demo-video-btn" onClick={() => setShowVideo(true)}>
            <Play size={14} fill="currentColor" />
            <span className="demo-video-btn-label">Watch demo</span>
          </button>
          <button
            type="button"
            className="demo-theme-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/login" className="demo-nav-ghost">Sign in</Link>
          <Link href="/login" className="demo-btn demo-btn-primary demo-btn-sm">Get started</Link>
        </div>
      </header>

      {/* ── Banner ── */}
      <div className="demo-banner">
        Demo mode — a lightweight model, short replies, and {DEMO_MESSAGE_LIMIT} messages.{' '}
        <span className="demo-banner-muted">The full canvas is smarter and unlimited.</span>
      </div>

      {/* ── Main: chat + tree ── */}
      <main className="demo-main">
        <section className="demo-chat">
          <div className="demo-chat-scroll" ref={scrollRef}>
            {thread.map((node) => (
              <div key={node.id} className={`demo-msg demo-msg-${node.role}`}>
                <div className={`demo-bubble demo-bubble-${node.role}`}>
                  {node.role === 'assistant' && node.id === streamingId && !node.content.trim() ? (
                    <span className="demo-typing"><i /><i /><i /></span>
                  ) : node.role === 'assistant' ? (
                    <Markdown text={node.content} />
                  ) : (
                    node.content
                  )}
                </div>
              </div>
            ))}

            <p className="demo-hint">
              Tip: click any node in the tree, then ask something — your reply starts a new branch.
            </p>
          </div>

          {/* ── Composer ── */}
          <div className="demo-composer">
            {error && <div className="demo-error">{error}</div>}

            {atLimit ? (
              <button className="demo-btn demo-btn-primary demo-composer-locked" onClick={() => setShowWall(true)}>
                You&rsquo;ve used your {DEMO_MESSAGE_LIMIT} demo messages — sign up to keep going
              </button>
            ) : (
              <>
                <form className="demo-form" onSubmit={(e) => { e.preventDefault(); send() }}>
                  <button
                    type="button"
                    className="demo-attach"
                    title="Sign up to attach files"
                    onClick={() => setShowWall(true)}
                    disabled={isStreaming}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M14 8.5l-6.5 6.5A4 4 0 0 1 1.9 9.4l7.1-7.1a2.5 2.5 0 0 1 3.5 3.5L5.4 12.9a1 1 0 0 1-1.4-1.4L10.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <textarea
                    ref={textareaRef}
                    className="demo-textarea"
                    placeholder="Message the demo…  (Enter to send)"
                    value={input}
                    maxLength={DEMO_CHAR_LIMIT}
                    rows={1}
                    disabled={isStreaming}
                    onChange={(e) => { setInput(e.target.value.slice(0, DEMO_CHAR_LIMIT)); autoResize(e.target) }}
                    onKeyDown={onComposerKeyDown}
                  />
                  <button type="submit" className="demo-send-btn" disabled={!canSend} aria-label="Send">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M13 1L1 5.5l5 1.5 1.5 5L13 1z" stroke={canSend ? 'white' : 'var(--text-muted)'} strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
                <div className="demo-meta">
                  <span className={`demo-counter ${input.length >= DEMO_CHAR_LIMIT ? 'demo-counter-max' : ''}`}>
                    {input.length}/{DEMO_CHAR_LIMIT}
                  </span>
                  <span className="demo-remaining">{remaining} of {DEMO_MESSAGE_LIMIT} messages left</span>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="demo-tree">
          <DemoTree
            nodes={nodes}
            meta={meta}
            colors={SEED_COLORS}
            seedStickies={DEMO_STICKIES}
            selectedId={selectedId}
            onSelect={handleSelect}
            streamingId={streamingId}
            ghostParentId={ghostParentId}
            ghostText={isStreaming ? '' : input}
          />
        </section>
      </main>

      {/* ── Sign-up wall ── */}
      {showWall && (
        <div className="demo-wall-overlay" onClick={() => setShowWall(false)}>
          <div className="demo-wall" onClick={(e) => e.stopPropagation()}>
            <button className="demo-wall-close" onClick={() => setShowWall(false)} aria-label="Close">
              ✕
            </button>
            <h2 className="demo-wall-title">You&rsquo;ve reached the demo limit</h2>
            <p className="demo-wall-sub">
              Create a free account to keep branching — with smarter models and a lot more room.
            </p>
            <ul className="demo-wall-list">
              {WALL_BENEFITS.map((b) => (
                <li key={b}>
                  <span className="demo-wall-check" aria-hidden>✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <Link href="/login" className="demo-btn demo-btn-primary demo-btn-lg demo-wall-cta">
              Sign up free
            </Link>
            <button className="demo-wall-later" onClick={() => setShowWall(false)}>
              Keep looking around
            </button>
          </div>
        </div>
      )}

      {/* ── Demo video popup (same modal as the front page) ── */}
      {showVideo && (
        <div className="demo-video-modal" onClick={() => setShowVideo(false)}>
          <div className="demo-video-frame" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="demo-video-close"
              onClick={() => setShowVideo(false)}
              aria-label="Close video"
            >
              <X size={16} /> Close · Esc
            </button>
            <iframe
              src={DEMO_VIDEO_SRC}
              title="Nodea — branching AI chat canvas"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  )
}
