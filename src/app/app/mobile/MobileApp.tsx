'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { useApp, type ChatMessage } from '../App'
import { colorById } from '../projectConstants'
import type { ChatProject } from '../chatProjectTypes'
import type { Conversation } from '../App'
import TreeThumb, { type MiniTree } from '../TreeThumb'
import {
  IcMenu, IcPlus, IcSearch, IcSettings, IcSun, IcMoon, IcBranch, IcX, IcChat,
  IcTree, IcChevR, ProjectIcon, PinGlyph, Markdown, CopyBtn,
} from './MobileUI'
import { MobileTree } from './MobileTree'
import {
  type MNode, childrenOf, deepestTip, generateTitle, generateSummary, fmtRelative, fmtTime,
} from './treeModel'
import './mobile.css'

// ── attachment-header strip (user content stores att metadata inline) ────────
const ATT_OPEN = '<<<NODEA_ATT_V1\n', ATT_CLOSE = '\nNODEA_ATT_V1>>>\n'
function stripAtt(c: string): string {
  if (!c.startsWith(ATT_OPEN)) return c
  const i = c.indexOf(ATT_CLOSE)
  return i < 0 ? c : c.slice(i + ATT_CLOSE.length)
}

function modelLabel(modelId?: string): string {
  if (!modelId) return 'Claude'
  const m = modelId.toLowerCase()
  if (m.includes('opus')) return 'Claude · Opus'
  if (m.includes('sonnet')) return 'Claude · Sonnet'
  if (m.includes('haiku')) return 'Claude · Haiku'
  return 'Claude'
}

function initials(name: string, email: string): string {
  const src = (name || email || 'You').trim()
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

// Collapse raw user/assistant rows into prompt+answer pairs for the thumbnail —
// mirrors the desktop ProjectPage's buildMiniTree.
interface NodeRow { id: string; parent_id: string | null; role: 'user' | 'assistant' }
function buildMiniTree(rows: NodeRow[]): MiniTree {
  const nodeMap = new Map(rows.map((r) => [r.id, r]))
  const nodes: { id: string; parent: string | null }[] = []
  const pairedUserIds = new Set<string>()
  for (const node of rows) {
    if (node.role !== 'assistant') continue
    const userParent = node.parent_id ? nodeMap.get(node.parent_id) : null
    if (!userParent || userParent.role !== 'user') continue
    pairedUserIds.add(userParent.id)
    const gp = userParent.parent_id ? nodeMap.get(userParent.parent_id) : null
    nodes.push({ id: node.id, parent: gp?.role === 'assistant' ? gp.id : null })
  }
  for (const node of rows) {
    if (node.role !== 'user' || pairedUserIds.has(node.id)) continue
    const parent = node.parent_id ? nodeMap.get(node.parent_id) : null
    nodes.push({ id: node.id, parent: parent?.role === 'assistant' ? parent.id : null })
  }
  const childCount = new Map<string | null, number>()
  for (const n of nodes) childCount.set(n.parent, (childCount.get(n.parent) ?? 0) + 1)
  let branches = 0
  for (const [parent, count] of childCount) if (parent !== null && count > 1) branches += 1
  return { nodes, count: nodes.length, branches }
}

interface MobileAppProps {
  onSaveMemory: (projectId: string, memory: string) => Promise<void>
}

export default function MobileApp({ onSaveMemory }: MobileAppProps) {
  const app = useApp()
  const { theme, toggleTheme } = useTheme()
  const [drawer, setDrawer] = useState(false)

  const activeConv = app.conversations.find((c) => c.id === app.activeConvId) ?? null
  const activeProject = app.chatProjects.find((p) => p.id === app.activeChatProjectId) ?? null

  return (
    <div className="nm-root">
      <div className="nm-app">
        {app.view === 'chat' && (
          <Canvas
            key={app.activeConvId ?? 'none'}
            theme={theme} onToggleTheme={toggleTheme}
            onMenu={() => setDrawer(true)} activeConv={activeConv}
          />
        )}
        {app.view === 'projects' && (
          <ProjectsScreen theme={theme} onToggleTheme={toggleTheme} onMenu={() => setDrawer(true)} />
        )}
        {app.view === 'project' && activeProject && (
          <ProjectScreen
            key={activeProject.id}
            project={activeProject} theme={theme} onToggleTheme={toggleTheme}
            onSaveMemory={onSaveMemory}
          />
        )}

        <Drawer show={drawer} onClose={() => setDrawer(false)} />
      </div>
    </div>
  )
}

/* ── Top bar ─────────────────────────────────────────────────── */
function TopBar({ canvas, view, setView, onMenu, theme, onToggleTheme }: {
  canvas: { name: string; color: string | null }
  view: 'chat' | 'tree'; setView: (v: 'chat' | 'tree') => void
  onMenu: () => void; theme: string; onToggleTheme: () => void
}) {
  return (
    <div className="nm-top">
      <div className="nm-topbar">
        <button className="nm-icbtn" onClick={onMenu} aria-label="Menu"><IcMenu s={21} /></button>
        <div className="nm-title">
          <div className="nm-title-row">
            {canvas.color && <span className="nm-cdot" style={{ background: canvas.color }} />}
            <span className="nm-cname">{canvas.name}</span>
          </div>
        </div>
        <div className="nm-seg">
          <button className={view === 'chat' ? 'on' : ''} onClick={() => setView('chat')}><IcChat s={15} />Chat</button>
          <button className={view === 'tree' ? 'on' : ''} onClick={() => setView('tree')}><IcTree s={15} />Tree</button>
        </div>
        <button className="nm-icbtn" onClick={onToggleTheme} aria-label="Theme">
          {theme === 'dark' ? <IcSun s={19} /> : <IcMoon s={19} />}
        </button>
      </div>
    </div>
  )
}

/* ── Chat message ────────────────────────────────────────────── */
function Message({ msg, sourceIcon, streaming, highlighted, childBranches, versions, onBranch, onPick, onVersion }: {
  msg: ChatMessage
  sourceIcon: string
  streaming: boolean
  highlighted: boolean
  childBranches: number
  versions: { index: number; total: number; prevId: string | null; nextId: string | null } | null
  onBranch: () => void
  onPick: () => void
  onVersion: (id: string) => void
}) {
  if (msg.role === 'assistant') {
    const empty = streaming && !msg.content.trim()
    return (
      <div className="nm-m ai">
        <div className="nm-ai-head">
          <img src={sourceIcon} alt="" />{modelLabel(msg.modelId)}
          <span className="clock">{fmtTime(msg.timestamp)}</span>
        </div>
        <div className="nm-aibubble">
          {empty ? <span className="nm-typing"><i /><i /><i /></span> : <Markdown text={msg.content} />}
          {streaming && !empty && <span className="nm-cursor" />}
        </div>
        {!streaming && (
          <div className="nm-airow">
            <button className="nm-branchbtn" onClick={onBranch}><IcBranch s={13} />Branch from here</button>
            {childBranches > 1 && (
              <button className="nm-branchchip" onClick={onPick}>
                <IcTree s={13} /><span className="cnt">{childBranches}</span> branches
              </button>
            )}
            <CopyBtn text={msg.content} markdown />
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="nm-m user">
      <div className={`nm-userbubble ${highlighted ? 'hl' : ''}`}>{msg.content}</div>
      <div className="nm-ufoot">
        <CopyBtn text={msg.content} />
        {versions && versions.total > 1 && (
          <span className="nm-ver">
            <button disabled={!versions.prevId} onClick={() => versions.prevId && onVersion(versions.prevId)} aria-label="Previous version"><IcChevR s={13} style={{ transform: 'rotate(180deg)' }} /></button>
            <span className="n">{versions.index + 1}/{versions.total}</span>
            <button disabled={!versions.nextId} onClick={() => versions.nextId && onVersion(versions.nextId)} aria-label="Next version"><IcChevR s={13} /></button>
          </span>
        )}
        <span className="nm-uts">{fmtTime(msg.timestamp)}</span>
      </div>
    </div>
  )
}

/* ── Canvas (chat + tree for the active conversation) ────────── */
function Canvas({ theme, onToggleTheme, onMenu, activeConv }: {
  theme: string; onToggleTheme: () => void; onMenu: () => void; activeConv: Conversation | null
}) {
  const app = useApp()
  const [view, setView] = useState<'chat' | 'tree'>('chat')
  const [branchAnchor, setBranchAnchor] = useState<{ id: string; title: string } | null>(null)
  const [pickFor, setPickFor] = useState<ChatMessage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [focus, setFocus] = useState(false)

  const convColor = activeConv?.color ? colorById(activeConv.color).hex : 'var(--accent)'
  const canvasName = app.convName && app.convName !== 'Loading…' ? app.convName : (activeConv?.name ?? 'Nodea')

  // normalized tree nodes
  const mnodes: MNode[] = useMemo(() => app.allDbNodes.map((n) => ({
    id: n.id, parent: n.parent_id, role: n.role,
    text: n.role === 'user' ? stripAtt(n.content) : n.content,
    color: app.nodeColors[n.id] ?? n.color ?? null,
    ts: new Date(n.created_at).getTime(),
    title: app.nodeSummaries[n.id]?.title,
    summary: app.nodeSummaries[n.id]?.summary,
  })), [app.allDbNodes, app.nodeColors, app.nodeSummaries])

  // child-count per node (a node with >1 children forks into branches)
  const childCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of app.allDbNodes) if (n.parent_id) m.set(n.parent_id, (m.get(n.parent_id) ?? 0) + 1)
    return m
  }, [app.allDbNodes])

  // chat thread: while composing a branch, trim to the fork point
  const displayed = useMemo(() => {
    if (!branchAnchor) return app.messages
    const ai = app.messages.findIndex((m) => m.id === branchAnchor.id)
    return ai >= 0 ? app.messages.slice(0, ai + 1) : app.messages
  }, [app.messages, branchAnchor])

  useEffect(() => {
    if (view === 'chat' && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [displayed.length, app.isLoading, view, branchAnchor])

  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 104) + 'px' }, [app.input])
  useEffect(() => { if (branchAnchor && taRef.current) taRef.current.focus() }, [branchAnchor])

  const lastMsg = app.messages[app.messages.length - 1]
  const streamingId = app.isLoading && lastMsg?.role === 'assistant' ? lastMsg.id : null

  const branchLabelFor = (msg: ChatMessage): string => {
    // For an assistant reply, name the branch after the prompt that produced it.
    const node = app.allDbNodes.find((n) => n.id === msg.id)
    const userParent = node?.parent_id ? app.allDbNodes.find((n) => n.id === node.parent_id) : null
    if (userParent) return app.nodeSummaries[node!.id]?.title || generateTitle(stripAtt(userParent.content))
    return 'this point'
  }

  const startBranch = (id: string, title: string) => {
    void app.handleNodeClick(id)
    setBranchAnchor({ id, title })
    setView('chat')
    setPickFor(null)
    setTimeout(() => taRef.current?.focus(), 60)
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!app.input.trim() || app.isLoading) { e.stopPropagation(); return }
    setBranchAnchor(null)
    void app.handleSend(e)
  }
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = (e.target as HTMLTextAreaElement).form
      if (form) form.requestSubmit()
    }
  }

  const canvas = { name: canvasName, color: convColor }

  if (!app.activeConvId) {
    return (
      <>
        <TopBar canvas={{ name: 'Nodea', color: null }} view={view} setView={setView} onMenu={onMenu} theme={theme} onToggleTheme={onToggleTheme} />
        <div className="nm-blank"><div className="nm-spin" /><div className="t">Loading your canvas…</div></div>
      </>
    )
  }

  return (
    <>
      <TopBar canvas={canvas} view={view} setView={setView} onMenu={onMenu} theme={theme} onToggleTheme={onToggleTheme} />

      {view === 'chat' ? (
        <>
          <div className="nm-scroll" ref={scrollRef}>
            <div className="nm-thread">
              {displayed.map((m) => (
                <Message
                  key={m.id} msg={m}
                  sourceIcon={m.imported && app.activeConvSource ? `/models/${app.activeConvSource}.svg` : '/models/claude.svg'}
                  streaming={streamingId === m.id}
                  highlighted={app.highlightedMessageId === m.id}
                  childBranches={m.role === 'assistant' ? (childCount.get(m.id) ?? 0) : 0}
                  versions={m.role === 'user' ? app.promptVersionInfo(m.id) : null}
                  onBranch={() => startBranch(m.id, branchLabelFor(m))}
                  onPick={() => setPickFor(m)}
                  onVersion={(id) => { void app.handleNodeClick(id) }}
                />
              ))}
              <p className="nm-hint">Tap <b>Branch from here</b> on any reply to explore a new direction — your original path stays put.</p>
            </div>
          </div>

          <div className="nm-composer">
            {branchAnchor && (
              <div className="nm-branchctx">
                <span className="ico"><IcBranch s={16} /></span>
                <span className="lbl"><b>New branch</b><small>forking from “{branchAnchor.title}”</small></span>
                <button className="x" onClick={() => setBranchAnchor(null)} aria-label="Cancel branch"><IcX s={16} /></button>
              </div>
            )}
            <form className={`nm-form ${focus ? 'focus' : ''}`} onSubmit={submit}>
              <button type="button" className="nm-attach" aria-label="Attach">
                <svg width="19" height="19" viewBox="0 0 16 16" fill="none"><path d="M14 8.5l-6.5 6.5A4 4 0 0 1 1.9 9.4l7.1-7.1a2.5 2.5 0 0 1 3.5 3.5L5.4 12.9a1 1 0 0 1-1.4-1.4L10.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <textarea ref={taRef} rows={1} value={app.input}
                placeholder="Message Claude…"
                onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                onChange={(e) => app.setInput(e.target.value)} onKeyDown={onKey} />
              <button className="nm-send" type="submit" disabled={!app.input.trim() || app.isLoading} aria-label="Send">
                <svg width="17" height="17" viewBox="0 0 14 14" fill="none"><path d="M13 1L1 5.5l5 1.5 1.5 5L13 1z" stroke={app.input.trim() && !app.isLoading ? '#fff' : 'var(--text-muted)'} strokeWidth="1.5" strokeLinejoin="round" /></svg>
              </button>
            </form>
          </div>
        </>
      ) : (
        <MobileTree
          nodes={mnodes} selectedId={app.selectedNodeId} active={view === 'tree'} fitKey={app.messages.length}
          onSelect={(id) => { void app.handleNodeClick(id) }}
          onOpen={(id) => { void app.handleNodeClick(id); setView('chat') }}
          onBranch={(node) => startBranch(node.id, node.title || generateTitle(node.text))}
        />
      )}

      <BranchSheet
        pickFor={pickFor} mnodes={mnodes} nodeSummaries={app.nodeSummaries} nodeColors={app.nodeColors}
        onClose={() => setPickFor(null)}
        onPickBranch={(tip) => { void app.handleNodeClick(tip); setPickFor(null) }}
        onNewBranch={(m) => startBranch(m.id, branchLabelFor(m))}
      />
    </>
  )
}

/* ── Branch picker bottom sheet ─────────────────────────────── */
function BranchSheet({ pickFor, mnodes, nodeSummaries, nodeColors, onClose, onPickBranch, onNewBranch }: {
  pickFor: ChatMessage | null
  mnodes: MNode[]
  nodeSummaries: Record<string, { title: string; summary: string }>
  nodeColors: Record<string, string>
  onClose: () => void
  onPickBranch: (tip: string) => void
  onNewBranch: (m: ChatMessage) => void
}) {
  const show = !!pickFor
  const kids = useMemo(() => {
    if (!pickFor) return []
    const ch = childrenOf(mnodes)
    return (ch.get(pickFor.id) || []).map((u) => {
      const tip = deepestTip(mnodes, u.id)
      const aChild = (ch.get(u.id) || [])[0]
      return {
        user: u, tip,
        title: u.title || generateTitle(u.text),
        summary: aChild ? (nodeSummaries[aChild.id]?.summary || generateSummary(aChild.text)) : u.text,
        color: nodeColors[u.id] || u.color || (aChild && aChild.color),
      }
    })
  }, [pickFor, mnodes, nodeSummaries, nodeColors])

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
          <button className="nm-pick add" onClick={() => pickFor && onNewBranch(pickFor)}><IcBranch s={16} />Start a new branch</button>
        </div>
      </div>
    </>
  )
}

/* ── Drawer (canvas + projects sidebar) ─────────────────────── */
function Drawer({ show, onClose }: { show: boolean; onClose: () => void }) {
  const app = useApp()
  const pinned = app.chatProjects.filter((p) => p.pinned)
  const loose = app.conversations.filter((c) => !c.chat_project_id)
  const chatCount = (pid: string) => app.conversations.filter((c) => c.chat_project_id === pid).length

  const goToConv = (id: string) => { app.openChatView(id); void app.switchConversation(id); onClose() }
  const newCanvas = () => { void app.createConversation(); app.openChatView(); onClose() }

  return (
    <>
      <div className={`nm-overlay ${show ? 'show' : ''}`} onClick={onClose} />
      <aside className={`nm-drawer ${show ? 'show' : ''}`}>
        <div className="nm-dr-head">
          <span className="nm-dr-wm">Nodea</span>
          <button className="nm-dr-x" onClick={onClose} aria-label="Close"><IcX s={20} /></button>
        </div>
        <button className="nm-dr-new" onClick={newCanvas}><IcPlus s={18} />New canvas</button>
        <button className="nm-dr-search" onClick={() => { app.setIsSearchOpen(true); onClose() }}><IcSearch s={16} />Search</button>
        <div className="nm-dr-list">
          {pinned.length > 0 && <div className="nm-dr-sec">Projects</div>}
          {pinned.map((p) => {
            const c = colorById(p.color)
            return (
              <div key={p.id} className="nm-dr-proj" onClick={() => { app.openProject(p.id); onClose() }}>
                <span className="tile" style={{ background: c.soft }}><ProjectIcon name={p.icon} size={17} color={c.hex} /></span>
                <span className="nm">{p.name}</span>
                <span className="ct">{chatCount(p.id)}</span>
                <span className="pin"><PinGlyph s={11} color={c.hex} /></span>
              </div>
            )
          })}
          <button className="nm-dr-allproj" onClick={() => { app.openProjectsLanding(); onClose() }}>
            <ProjectIcon name="layers" size={15} />All projects<span className="chev"><IcChevR s={15} /></span>
          </button>

          <div className="nm-dr-sec" style={{ marginTop: 6 }}>Canvases</div>
          {loose.map((c) => {
            const dot = c.color ? colorById(c.color).hex : 'var(--accent)'
            return (
              <div key={c.id} className={`nm-dr-conv ${c.id === app.activeConvId && app.view === 'chat' ? 'active' : ''}`} onClick={() => goToConv(c.id)}>
                <span className="dot" style={{ background: dot }} />
                <span className="nm">{c.name}</span>
              </div>
            )
          })}
        </div>
        <div className="nm-dr-foot">
          <div className="nm-dr-ava">{initials(app.userName, app.userEmail)}</div>
          <div className="who">{app.userName || 'You'}<small>{app.isPro ? 'Pro plan' : 'Free plan'}</small></div>
          <button className="ico" aria-label="Settings" onClick={() => { app.setIsSettingsOpen(true); onClose() }}><IcSettings s={18} /></button>
        </div>
      </aside>
    </>
  )
}

/* ── Secondary-screen header ─────────────────────────────────── */
function ScreenHeader({ title, onMenu, onBack, backLabel, theme, onToggleTheme }: {
  title: string; onMenu?: () => void; onBack?: () => void; backLabel?: string
  theme: string; onToggleTheme: () => void
}) {
  return (
    <div className="nm-shead">
      <div className="nm-shead-bar">
        {onBack
          ? <button className="nm-back" onClick={onBack}><IcChevR s={17} style={{ transform: 'rotate(180deg)' }} />{backLabel || 'Back'}</button>
          : <button className="nm-icbtn" onClick={onMenu} aria-label="Menu"><IcMenu s={21} /></button>}
        <span className="t">{title}</span>
        <button className="nm-icbtn" onClick={onToggleTheme} aria-label="Theme">{theme === 'dark' ? <IcSun s={19} /> : <IcMoon s={19} />}</button>
      </div>
    </div>
  )
}

/* ── Projects landing ────────────────────────────────────────── */
function ProjectsScreen({ theme, onToggleTheme, onMenu }: { theme: string; onToggleTheme: () => void; onMenu: () => void }) {
  const app = useApp()
  const projects = app.chatProjects
  const pinnedCount = projects.filter((p) => p.pinned).length
  return (
    <>
      <ScreenHeader title="Projects" onMenu={onMenu} theme={theme} onToggleTheme={onToggleTheme} />
      {projects.length === 0 ? (
        <div className="nm-pempty">
          <div>
            <div className="ic"><ProjectIcon name="layers" size={32} color="var(--accent)" sw={1.5} /></div>
            <h2>Organize your conversations</h2>
            <p>Projects group related chats — give each a color and icon, and pin your favorites to the sidebar.</p>
            <button className="nm-pl-new" onClick={app.openNewProjectModal} style={{ margin: '0 auto' }}><IcPlus s={15} />Create your first project</button>
          </div>
        </div>
      ) : (
        <div className="nm-pscroll">
          <div className="nm-pl-head">
            <div>
              <div className="nm-pl-h1">Projects</div>
              <div className="nm-pl-sub">{projects.length} project{projects.length === 1 ? '' : 's'} · {pinnedCount} pinned to sidebar</div>
            </div>
            <button className="nm-pl-new" onClick={app.openNewProjectModal}><IcPlus s={15} />New</button>
          </div>
          <div className="nm-pcards">
            {projects.map((p) => <ProjectCard key={p.id} project={p} conversations={app.conversations} onOpen={() => app.openProject(p.id)} />)}
            <button className="nm-pcard-create" onClick={app.openNewProjectModal}><span className="circ"><IcPlus s={17} /></span>Create project</button>
          </div>
        </div>
      )}
    </>
  )
}

function ProjectCard({ project, conversations, onOpen }: { project: ChatProject; conversations: Conversation[]; onOpen: () => void }) {
  const c = colorById(project.color)
  const inProj = conversations.filter((cv) => cv.chat_project_id === project.id)
  const preview = inProj.slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0]
  const last = project.last_activity ? +new Date(project.last_activity) : null
  return (
    <div className="nm-pcard" onClick={onOpen}>
      <div className="band" style={{ background: c.hex }} />
      <div className="body">
        <div className="top">
          <span className="nm-ptile" style={{ width: 40, height: 40, background: c.soft }}><ProjectIcon name={project.icon} size={21} color={c.hex} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nm">{project.name}</div>
            <div className="meta"><b>{project.chat_count} chat{project.chat_count === 1 ? '' : 's'}</b><span className="d" />{fmtRelative(last)}</div>
          </div>
          {project.pinned && <span className="pin"><PinGlyph s={13} color={c.hex} /></span>}
        </div>
        <div className="prev">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
          <span>{preview ? preview.name : 'No conversations yet'}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Project page ────────────────────────────────────────────── */
function ProjectScreen({ project, theme, onToggleTheme, onSaveMemory }: {
  project: ChatProject; theme: string; onToggleTheme: () => void
  onSaveMemory: (projectId: string, memory: string) => Promise<void>
}) {
  const app = useApp()
  const supabase = useMemo(() => createClient(), [])
  const c = colorById(project.color)
  const convs = app.conversations.filter((cv) => cv.chat_project_id === project.id)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  const [draft, setDraft] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [trees, setTrees] = useState<Record<string, MiniTree>>({})

  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 100) + 'px' }, [draft])

  // Lazily fetch a tree per conversation for the row thumbnails.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const missing = convs.filter((cv) => !trees[cv.id])
      if (missing.length === 0) return
      const results = await Promise.all(missing.map(async (cv) => {
        const { data, error } = await supabase.from('nodes').select('id, parent_id, role').eq('project_id', cv.id).order('created_at', { ascending: true })
        if (error || !data) return [cv.id, null] as const
        return [cv.id, buildMiniTree(data as NodeRow[])] as const
      }))
      if (cancelled) return
      setTrees((prev) => {
        const next = { ...prev }
        for (const [id, t] of results) if (t) next[id] = t
        return next
      })
    }
    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs.map((cv) => cv.id).join('|')])

  const startChat = () => { void app.requestNewChatInProject(project.id, draft.trim() || undefined); setDraft('') }
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startChat() } }
  const lastActivity = project.last_activity ? +new Date(project.last_activity) : null

  return (
    <>
      <ScreenHeader title={project.name} onBack={app.openProjectsLanding} backLabel="Projects" theme={theme} onToggleTheme={onToggleTheme} />
      <div className="nm-pp-band" style={{ background: c.hex }} />
      <div className="nm-pscroll">
        <div className="nm-pp-head">
          <span className="nm-pp-tile" style={{ background: c.soft }}><ProjectIcon name={project.icon} size={26} color={c.hex} /></span>
          <div className="nm-pp-htext">
            <div className="nm-pp-name">{project.name}{project.pinned && <span className="pin"><PinGlyph s={14} color={c.hex} /></span>}</div>
            <div className="nm-pp-meta">{convs.length} conversation{convs.length === 1 ? '' : 's'}{lastActivity ? ` · last active ${fmtRelative(lastActivity)}` : ''}</div>
            {project.description && <div className="nm-pp-desc">{project.description}</div>}
          </div>
        </div>

        <form className="nm-pp-form" onSubmit={(e) => { e.preventDefault(); startChat() }}>
          <span className="lead" style={{ background: c.soft }}><ProjectIcon name={project.icon} size={13} color={c.hex} /></span>
          <textarea ref={taRef} rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
            placeholder={`Start a new chat in ${project.name}…`} />
          <button className="nm-pp-send" type="submit" style={{ background: c.hex }} aria-label="Start chat">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>

        <MemoryBox project={project} color={c.hex} onSave={(mem) => onSaveMemory(project.id, mem)} />

        <div className="nm-sec-row"><span className="l">Conversations</span><span className="r">Each shows its tree shape</span></div>
        {convs.length === 0 ? (
          <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 12 }}>
            No conversations yet. Start one with the prompt above.
          </div>
        ) : (
          <div className="nm-convs">
            {convs.map((cv) => (
              <ConvRow key={cv.id} conv={cv} color={c.hex} tree={trees[cv.id]}
                onOpen={() => { app.openChatView(cv.id); void app.switchConversation(cv.id) }} />
            ))}
          </div>
        )}

        <div className="nm-soon">
          <span className="ic"><IcBranch s={16} style={{ opacity: 0.7 }} /></span>
          <div>
            <div className="tt">Connected canvas — coming soon</div>
            <div className="ss">Soon you’ll see every conversation in this project as one connected tree.</div>
          </div>
        </div>
      </div>
    </>
  )
}

function ConvRow({ conv, color, tree, onOpen }: { conv: Conversation; color: string; tree?: MiniTree; onOpen: () => void }) {
  return (
    <div className="nm-convrow" onClick={onOpen}>
      <div className="info">
        <div className="nm">{conv.name}</div>
        <div className="stat">
          {tree && tree.count > 0 ? (
            <>
              <span>{tree.count} node{tree.count === 1 ? '' : 's'}</span>
              {tree.branches > 0 && <><span className="d" /><span className="br">{tree.branches} branch{tree.branches === 1 ? '' : 'es'}</span></>}
            </>
          ) : <span>{tree ? 'Empty conversation' : 'Loading…'}</span>}
          <span className="d" /><span>{fmtRelative(+new Date(conv.created_at))}</span>
        </div>
      </div>
      <div className="thumb">
        {tree && tree.count > 0
          ? <TreeThumb tree={tree} color={color} width={90} height={54} />
          : <IcBranch s={18} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />}
      </div>
      <span className="chev"><IcChevR s={15} /></span>
    </div>
  )
}

/* ── Memory box (per-project context, editable) ─────────────── */
function MemoryBox({ project, color, onSave }: { project: ChatProject; color: string; onSave: (memory: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.memory || '')
  const [saving, setSaving] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (!editing) setDraft(project.memory || '') }, [project.memory, editing])
  useEffect(() => { if (editing && taRef.current) { const el = taRef.current; el.focus(); el.setSelectionRange(el.value.length, el.value.length) } }, [editing])
  const mem = (project.memory || '').trim()
  const save = async () => {
    if (saving) return
    setSaving(true)
    try { await onSave(draft.trim()); setEditing(false) }
    catch { /* keep edit mode open on failure */ }
    finally { setSaving(false) }
  }
  return (
    <div className="nm-mem">
      <div className="nm-mem-h">
        <span className="t">Memory</span>
        {!editing && (
          <>
            <span className="priv">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              Only you
            </span>
            <button className="nm-mem-edit" onClick={() => setEditing(true)} aria-label="Edit memory">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
            </button>
          </>
        )}
      </div>
      {editing ? (
        <>
          <textarea ref={taRef} value={draft} rows={6} maxLength={2000}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            placeholder="Context Nodea should remember for every chat in this project — goals, tone, key facts…" />
          <div className="nm-mem-foot">
            <span className="cnt">{draft.length} / 2000</span>
            <div className="btns">
              <button className="cancel" onClick={() => { setEditing(false); setDraft(project.memory || '') }} disabled={saving}>Cancel</button>
              <button style={{ background: saving ? 'var(--bg-muted)' : color, color: saving ? 'var(--text-muted)' : '#fff' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </>
      ) : mem ? (
        <div className="nm-mem-body">{mem}</div>
      ) : (
        <button className="nm-mem-add" onClick={() => setEditing(true)}>Add context Nodea should keep in mind for every chat in this project.</button>
      )}
    </div>
  )
}
