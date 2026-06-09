'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useTheme } from '@/lib/theme'
import { MobileTree } from '../app/mobile/MobileTree'
import {
  IcMenu, IcSun, IcMoon, IcBranch, IcX, IcChat, IcTree, IcChevR, Markdown, CopyBtn,
} from '../app/mobile/MobileUI'
import {
  type MNode, childrenOf, pathTo, deepestTip, generateTitle, generateSummary, fmtTime,
} from '../app/mobile/treeModel'
import {
  SEED_NODES, SEED_META, SEED_COLORS, DEMO_INITIAL_SELECTED,
  DEMO_MESSAGE_LIMIT, DEMO_CHAR_LIMIT, type DemoNode, type NodeMeta,
} from './demoSeed'
import '../app/mobile/mobile.css'

const VIOLET = '#8b5cf6'

const WALL_BENEFITS = [
  'Smarter models — Sonnet & Opus',
  'Full-length, in-depth answers',
  'Save your canvases & projects',
  'Far more messages each day',
  'Upload files, images & PDFs',
]

const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'What is Nodea', href: '/what-is-nodea' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Features', href: '/#features' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pricing', href: '/upgrade' },
]

function makeTitle(prompt: string): string {
  const s = prompt.split(/[.!?\n]/)[0].trim()
  return s.length <= 42 ? s : s.slice(0, 41) + '…'
}

export default function MobileDemo() {
  const { theme, toggleTheme } = useTheme()
  const [nodes, setNodes] = useState<DemoNode[]>(SEED_NODES)
  const [meta, setMeta] = useState<Record<string, NodeMeta>>(SEED_META)
  const [liveColors, setLiveColors] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_INITIAL_SELECTED)
  const [input, setInput] = useState('')
  const [isStreaming, setStreaming] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [sentCount, setSentCount] = useState(0)
  const [showWall, setShowWall] = useState(false)
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'chat' | 'tree'>('chat')
  const [branchAnchor, setBranchAnchor] = useState<{ id: string; title: string } | null>(null)
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [focus, setFocus] = useState(false)
  const [fitKey, setFitKey] = useState(0)

  const idRef = useRef(1000)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const atLimit = sentCount >= DEMO_MESSAGE_LIMIT
  const remaining = Math.max(0, DEMO_MESSAGE_LIMIT - sentCount)

  // colors: seed (keyed by assistant pair id) + live branch colors
  const colorMap = useMemo(() => ({ ...SEED_COLORS, ...liveColors }), [liveColors])

  const mnodes: MNode[] = useMemo(() => nodes.map((n) => ({
    id: n.id, parent: n.parent_id, role: n.role, text: n.content,
    color: colorMap[n.id] ?? null, ts: +new Date(n.created_at),
    title: meta[n.id]?.title, summary: meta[n.id]?.summary,
  })), [nodes, colorMap, meta])

  const thread = useMemo(() => pathTo(mnodes, selectedId), [mnodes, selectedId])
  const displayed = useMemo(() => {
    if (!branchAnchor) return thread
    const ai = thread.findIndex((m) => m.id === branchAnchor.id)
    return ai >= 0 ? thread.slice(0, ai + 1) : thread
  }, [thread, branchAnchor])

  const childCount = useMemo(() => {
    const ch = childrenOf(mnodes)
    return (id: string) => (ch.get(id) || []).length
  }, [mnodes])

  useEffect(() => {
    if (view === 'chat' && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [displayed.length, isStreaming, view, branchAnchor])
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 104) + 'px' }, [input])
  useEffect(() => { if (branchAnchor && taRef.current) taRef.current.focus() }, [branchAnchor])

  const send = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    if (atLimit) { setShowWall(true); return }

    const parentId = branchAnchor ? branchAnchor.id : selectedId
    const isBranch = !!branchAnchor
    const userId = `u${idRef.current++}`
    const aiId = `a${idRef.current++}`
    const now = Date.now()
    const userNode: DemoNode = { id: userId, parent_id: parentId, role: 'user', content: text, created_at: new Date(now).toISOString() }
    const aiNode: DemoNode = { id: aiId, parent_id: userId, role: 'assistant', content: '', created_at: new Date(now + 1).toISOString() }

    const history = pathTo(mnodes, parentId)
    const apiMessages = [...history.map((m) => ({ role: m.role, content: m.text })), { role: userNode.role, content: text }]

    const turnNumber = sentCount + 1
    setNodes((prev) => [...prev, userNode, aiNode])
    if (isBranch) setLiveColors((prev) => ({ ...prev, [aiId]: VIOLET, [userId]: VIOLET }))
    setSelectedId(aiId)
    setStreamingId(aiId)
    setStreaming(true)
    setSentCount(turnNumber)
    setInput('')
    setBranchAnchor(null)
    setError(null)
    setFitKey((k) => k + 1)
    track('demo_message_sent', { turn: turnNumber })

    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
      if (!res.ok || !res.body) {
        throw new Error(res.status === 429 ? 'The demo is busy right now — give it a minute and try again.' : 'Something went wrong. Please try again.')
      }
      const reader = res.body.getReader()
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
      setMeta((prev) => ({ ...prev, [aiId]: { title: makeTitle(text), summary: generateSummary(full) } }))
      if (turnNumber >= DEMO_MESSAGE_LIMIT) { track('demo_limit_reached'); setTimeout(() => setShowWall(true), 800) }
    } catch (err) {
      setNodes((prev) => prev.filter((n) => n.id !== aiId && n.id !== userId))
      setSelectedId(parentId)
      setSentCount((c) => Math.max(0, c - 1))
      setInput(text)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setStreaming(false)
      setStreamingId(null)
    }
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); void send() }
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }

  const startBranch = (node: MNode) => {
    // name the branch after the prompt that produced this reply
    let title = node.title || generateTitle(node.text)
    if (node.role === 'assistant') {
      const parent = mnodes.find((n) => n.id === node.parent)
      if (parent) title = parent.title || generateTitle(parent.text)
    }
    setSelectedId(node.id)
    setBranchAnchor({ id: node.id, title })
    setView('chat')
    setPickFor(null)
    setTimeout(() => taRef.current?.focus(), 60)
  }

  const canvas = { name: 'The Conservatory', color: '#3b82f6' }

  return (
    <div className="nm-root">
      <div className="nm-app" data-theme={theme}>
        {/* Top bar */}
        <div className="nm-top">
          <div className="nm-topbar">
            <button className="nm-icbtn" onClick={() => setMenu(true)} aria-label="Menu"><IcMenu s={21} /></button>
            <div className="nm-title">
              <div className="nm-title-row">
                <span className="nm-cdot" style={{ background: canvas.color }} />
                <span className="nm-cname">{canvas.name}</span>
              </div>
            </div>
            <div className="nm-seg">
              <button className={view === 'chat' ? 'on' : ''} onClick={() => setView('chat')}><IcChat s={15} />Chat</button>
              <button className={view === 'tree' ? 'on' : ''} onClick={() => setView('tree')}><IcTree s={15} />Tree</button>
            </div>
            <button className="nm-icbtn" onClick={toggleTheme} aria-label="Theme">{theme === 'dark' ? <IcSun s={19} /> : <IcMoon s={19} />}</button>
          </div>
        </div>

        {view === 'chat' && (
          <div className="nm-banner">Demo mode — a lightweight model, short replies, {DEMO_MESSAGE_LIMIT} messages. <span className="mut">The full canvas is smarter and unlimited.</span></div>
        )}

        {view === 'chat' ? (
          <>
            <div className="nm-scroll" ref={scrollRef}>
              <div className="nm-thread">
                {displayed.map((m) => (
                  m.role === 'assistant' ? (
                    <div key={m.id} className="nm-m ai">
                      <div className="nm-ai-head"><img src="/models/claude.svg" alt="" />Claude · Haiku<span className="clock">{fmtTime(m.ts)}</span></div>
                      <div className="nm-aibubble">
                        {streamingId === m.id && !m.text.trim() ? <span className="nm-typing"><i /><i /><i /></span> : <Markdown text={m.text} />}
                        {streamingId === m.id && m.text.trim() !== '' && <span className="nm-cursor" />}
                      </div>
                      {streamingId !== m.id && (
                        <div className="nm-airow">
                          <button className="nm-branchbtn" onClick={() => startBranch(m)}><IcBranch s={13} />Branch from here</button>
                          {childCount(m.id) > 1 && (
                            <button className="nm-branchchip" onClick={() => setPickFor(m.id)}>
                              <IcTree s={13} /><span className="cnt">{childCount(m.id)}</span> branches
                            </button>
                          )}
                          <CopyBtn text={m.text} markdown />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div key={m.id} className="nm-m user">
                      <div className="nm-userbubble">{m.text}</div>
                      <div className="nm-ufoot"><CopyBtn text={m.text} /><span className="nm-uts">{fmtTime(m.ts)}</span></div>
                    </div>
                  )
                ))}
                <p className="nm-hint">Tap <b>Branch from here</b> on any reply to explore a new direction — your original path stays put.</p>
              </div>
            </div>

            <div className="nm-composer">
              {error && <div className="nm-error">{error}</div>}
              {atLimit ? (
                <button className="nm-locked" onClick={() => setShowWall(true)}>You&rsquo;ve used your {DEMO_MESSAGE_LIMIT} demo messages — sign up to keep going</button>
              ) : (
                <>
                  {branchAnchor && (
                    <div className="nm-branchctx">
                      <span className="ico"><IcBranch s={16} /></span>
                      <span className="lbl"><b>New branch</b><small>forking from “{branchAnchor.title}”</small></span>
                      <button className="x" onClick={() => setBranchAnchor(null)} aria-label="Cancel branch"><IcX s={16} /></button>
                    </div>
                  )}
                  <form className={`nm-form ${focus ? 'focus' : ''}`} onSubmit={submit}>
                    <button type="button" className="nm-attach" aria-label="Attach" onClick={() => setShowWall(true)}>
                      <svg width="19" height="19" viewBox="0 0 16 16" fill="none"><path d="M14 8.5l-6.5 6.5A4 4 0 0 1 1.9 9.4l7.1-7.1a2.5 2.5 0 0 1 3.5 3.5L5.4 12.9a1 1 0 0 1-1.4-1.4L10.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <textarea ref={taRef} rows={1} value={input} maxLength={DEMO_CHAR_LIMIT} disabled={isStreaming}
                      placeholder="Message the demo…"
                      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                      onChange={(e) => setInput(e.target.value.slice(0, DEMO_CHAR_LIMIT))} onKeyDown={onKey} />
                    <button className="nm-send" type="submit" disabled={!input.trim() || isStreaming} aria-label="Send">
                      <svg width="17" height="17" viewBox="0 0 14 14" fill="none"><path d="M13 1L1 5.5l5 1.5 1.5 5L13 1z" stroke={input.trim() && !isStreaming ? '#fff' : 'var(--text-muted)'} strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    </button>
                  </form>
                  <div className="nm-cmeta">
                    <span className={input.length >= DEMO_CHAR_LIMIT ? 'max' : ''}>{input.length}/{DEMO_CHAR_LIMIT}</span>
                    <span>{remaining} of {DEMO_MESSAGE_LIMIT} messages left</span>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <MobileTree
            nodes={mnodes} selectedId={selectedId} active={view === 'tree'} fitKey={fitKey}
            onSelect={(id) => setSelectedId(id)}
            onOpen={(id) => { setSelectedId(id); setView('chat') }}
            onBranch={(node) => startBranch(node)}
          />
        )}

        {/* Branch picker */}
        <BranchSheet pickForId={pickFor} mnodes={mnodes} meta={meta} colorMap={colorMap}
          onClose={() => setPickFor(null)}
          onPickBranch={(tip) => { setSelectedId(tip); setPickFor(null) }}
          onNewBranch={(id) => { const n = mnodes.find((x) => x.id === id); if (n) startBranch(n) }} />

        {/* Sign-up wall */}
        <div className={`nm-overlay ${showWall ? 'show' : ''}`} onClick={() => setShowWall(false)} />
        <div className={`nm-sheet ${showWall ? 'show' : ''}`}>
          <div className="nm-sheet-grip" />
          <div className="nm-wall">
            <div className="wm">Nodea</div>
            <h2>You&rsquo;ve reached the demo limit</h2>
            <p className="sub">Create a free account to keep branching — with smarter models and a lot more room.</p>
            <ul>{WALL_BENEFITS.map((b) => <li key={b}><span className="ck">✓</span>{b}</li>)}</ul>
            <Link href="/login" className="cta">Sign up free</Link>
            <button className="later" onClick={() => setShowWall(false)}>Keep looking around</button>
          </div>
        </div>

        {/* Nav menu */}
        <div className={`nm-overlay ${menu ? 'show' : ''}`} onClick={() => setMenu(false)} />
        <div className={`nm-sheet ${menu ? 'show' : ''}`}>
          <div className="nm-sheet-grip" />
          <div className="nm-sheet-h">
            <div className="t" style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--accent)' }}>Nodea</div>
            <div className="s">Think in branches — a branching AI chat canvas.</div>
          </div>
          <div className="nm-sheet-list">
            {NAV_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="nm-pick" onClick={() => setMenu(false)}>
                <span className="body"><span className="tt">{l.label}</span></span>
                <span className="chev"><IcChevR s={16} /></span>
              </Link>
            ))}
            <Link href="/login" className="nm-pick add" onClick={() => setMenu(false)} style={{ borderStyle: 'solid', background: 'var(--accent)', color: '#fff' }}>Get started — free</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Branch picker bottom sheet (demo) ──────────────────────── */
function BranchSheet({ pickForId, mnodes, meta, colorMap, onClose, onPickBranch, onNewBranch }: {
  pickForId: string | null
  mnodes: MNode[]
  meta: Record<string, NodeMeta>
  colorMap: Record<string, string>
  onClose: () => void
  onPickBranch: (tip: string) => void
  onNewBranch: (id: string) => void
}) {
  const show = !!pickForId
  const kids = useMemo(() => {
    if (!pickForId) return []
    const ch = childrenOf(mnodes)
    return (ch.get(pickForId) || []).map((u) => {
      const tip = deepestTip(mnodes, u.id)
      const aChild = (ch.get(u.id) || [])[0]
      return {
        user: u, tip,
        title: u.title || generateTitle(u.text),
        summary: aChild ? (meta[aChild.id]?.summary || generateSummary(aChild.text)) : u.text,
        color: colorMap[u.id] || (aChild && colorMap[aChild.id]) || u.color,
      }
    })
  }, [pickForId, mnodes, meta, colorMap])

  return (
    <>
      <div className={`nm-overlay ${show ? 'show' : ''}`} onClick={onClose} />
      <div className={`nm-sheet ${show ? 'show' : ''}`}>
        <div className="nm-sheet-grip" />
        <div className="nm-sheet-h">
          <div className="t">Branches from here</div>
          <div className="s">This reply forks {kids.length} way{kids.length === 1 ? '' : 's'}. Jump to one, or start another.</div>
        </div>
        <div className="nm-sheet-list">
          {kids.map((k) => (
            <button key={k.user.id} className="nm-pick" onClick={() => onPickBranch(k.tip)}>
              <span className="d" style={{ background: k.color || 'var(--text-muted)' }} />
              <span className="body"><span className="tt">{k.title}</span><span className="ss">{k.summary}</span></span>
              <span className="chev"><IcChevR s={16} /></span>
            </button>
          ))}
          <button className="nm-pick add" onClick={() => pickForId && onNewBranch(pickForId)}><IcBranch s={16} />Start a new branch</button>
        </div>
      </div>
    </>
  )
}
