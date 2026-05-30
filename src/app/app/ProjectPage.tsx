'use client'

// ─── ProjectPage — single project view ───────────────────────────────────────
// Header (icon/name/color/optional description + settings menu).
// Prominent "Start a new chat" input.
// List of the project's conversations with timestamps and a mini tree thumb.
//
// Tree thumbs are fetched lazily — one `nodes` query per conversation, fired
// in parallel when the page mounts. While they load, we show the stat fallback
// based on raw node counts (or "Empty" if there are none yet).

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ProjectIcon, colorById } from './projectConstants'
import TreeThumb, { TreeStat, type MiniTree } from './TreeThumb'
import type { Conversation } from './App'
import type { ChatProject } from './chatProjectTypes'

interface Props {
  project: ChatProject
  conversations: Conversation[]
  onBack: () => void
  onOpenConv: (id: string) => void
  onNewChat: (initialMessage?: string) => void
  onConvContext: (conv: Conversation, x: number, y: number) => void
  onEdit: () => void
  onDelete: () => void
}

interface NodeRow {
  id: string
  parent_id: string | null
  role: 'user' | 'assistant'
}

interface TreeMap {
  [conversationId: string]: MiniTree
}

function formatTime(iso: string): string {
  const ts = new Date(iso).getTime()
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const hr  = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (sec < 60) return 'Just now'
  if (min < 60) return `${min}m ago`
  if (hr  < 24) return `${hr}h ago`
  if (day < 7)  return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function ProjectPage({
  project, conversations,
  onBack, onOpenConv, onNewChat, onConvContext, onEdit, onDelete,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const c = colorById(project.color)
  const convs = useMemo(
    () => conversations
      .filter((cv) => cv.chat_project_id === project.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [conversations, project.id],
  )

  const [trees, setTrees] = useState<TreeMap>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch one tree per conversation, in parallel. Each tree is cached in
  // state so re-renders don't re-fetch.
  useEffect(() => {
    let cancelled = false
    async function load() {
      // Skip ones we already have.
      const missing = convs.filter((cv) => !trees[cv.id])
      if (missing.length === 0) return
      const results = await Promise.all(missing.map(async (cv) => {
        const { data, error } = await supabase
          .from('nodes')
          .select('id, parent_id, role')
          .eq('project_id', cv.id)
          .order('created_at', { ascending: true })
        if (error || !data) return [cv.id, null] as const
        return [cv.id, buildMiniTree(data as NodeRow[])] as const
      }))
      if (cancelled) return
      const next: TreeMap = { ...trees }
      for (const [id, t] of results) {
        if (t) next[id] = t
      }
      setTrees(next)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs.map((c) => c.id).join('|')])

  // Close settings menu on outside click / escape.
  useEffect(() => {
    if (!menuOpen) return
    function close(e: MouseEvent) {
      if (menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)) {
        const within = (e.target as HTMLElement | null)?.closest('[data-settings-menu]')
        if (!within) setMenuOpen(false)
      }
    }
    function key(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', key)
    }
  }, [menuOpen])

  // Grow the new-chat input with its content, mirroring the chat composer.
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }
  useEffect(() => {
    if (inputRef.current) autoResize(inputRef.current)
  }, [draft])

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onNewChat(draft.trim() || undefined)
    setDraft('')
  }

  return (
    <div data-screen="project-page" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Colored top strip echoing the project color */}
      <div style={{ height: 3, background: c.hex }} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 32px 48px' }}>
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)',
            fontSize: 12.5, padding: '4px 0', marginBottom: 16,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7 2L3 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All projects
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24, position: 'relative' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: c.soft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ProjectIcon name={project.icon} size={27} color={c.hex} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <h1 style={{
                fontSize: 24, fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.025em',
                fontFamily: 'var(--font-bricolage)',
              }}>
                {project.name}
              </h1>
              {project.pinned && (
                <span title="Pinned to sidebar" style={{ color: c.hex }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 4h6l-1 6 3 3v2h-5v5l-1 1-1-1v-5H4v-2l3-3z" />
                  </svg>
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              {convs.length} conversation{convs.length === 1 ? '' : 's'}
              {project.last_activity && <> · last active {formatTime(project.last_activity)}</>}
            </div>
            {project.description && (
              <p style={{
                fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55,
                marginTop: 10, maxWidth: 520,
              }}>
                {project.description}
              </p>
            )}
          </div>

          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen((m) => !m)}
            title="Project settings"
            aria-label="Project settings"
            style={{
              width: 34, height: 34, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: menuOpen ? 'var(--bg-muted)' : 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 9,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.4" />
              <circle cx="8" cy="8" r="1.4" />
              <circle cx="8" cy="13" r="1.4" />
            </svg>
          </button>

          {menuOpen && (
            <SettingsMenu
              onEdit={() => { setMenuOpen(false); onEdit() }}
              onDelete={() => { setMenuOpen(false); onDelete() }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>

        {/* Prominent new-chat input */}
        <form
          onSubmit={submit}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 6px 6px 16px',
            marginBottom: 28,
            background: 'var(--input-bg)',
            border: '1.5px solid var(--border)',
            borderRadius: 13,
            boxShadow: 'var(--shadow-sm)',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLFormElement).style.borderColor = c.hex }}
          onBlurCapture={(e) => { (e.currentTarget as HTMLFormElement).style.borderColor = 'var(--border)' }}
        >
          <span style={{
            width: 20, height: 20, borderRadius: 6,
            background: c.soft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ProjectIcon name={project.icon} size={12} color={c.hex} />
          </span>
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(e) => { setDraft(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.closest('form')?.requestSubmit()
              }
            }}
            placeholder={`Start a new chat in ${project.name}…`}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 14,
              color: 'var(--text-primary)', fontFamily: 'inherit',
              resize: 'none', lineHeight: 1.5, maxHeight: 160, overflowY: 'auto',
            }}
          />
          <button
            type="submit"
            aria-label="Start chat"
            style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              border: 'none', cursor: 'pointer',
              background: c.hex, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>

        {/* Conversation list */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, padding: '0 2px' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            Conversations
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Each shows the shape of its branching tree
          </span>
        </div>

        {convs.length === 0 ? (
          <div style={{
            padding: '28px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
            border: '1px dashed var(--border)',
            borderRadius: 12,
          }}>
            No conversations yet. Start one with the prompt above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {convs.map((cv) => (
              <ConvRow
                key={cv.id}
                conv={cv}
                tree={trees[cv.id]}
                color={c.hex}
                onOpen={() => onOpenConv(cv.id)}
                onContext={(x, y) => onConvContext(cv, x, y)}
              />
            ))}
          </div>
        )}

        {/* Future-canvas hint */}
        <div style={{
          marginTop: 22,
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px dashed var(--border-strong)',
          display: 'flex', alignItems: 'center', gap: 12,
          color: 'var(--text-muted)',
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'var(--bg-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <circle cx="6" cy="6" r="2.2" />
              <circle cx="18" cy="6" r="2.2" />
              <circle cx="12" cy="18" r="2.2" />
              <path d="M7.5 7.5L11 16M16.5 7.5L13 16M8 6h8" />
            </svg>
          </span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Connected canvas — coming soon
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.45 }}>
              Soon you&rsquo;ll see every conversation in this project laid out as one connected tree.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Conversation row with the tree thumb ────────────────────────────────────

interface ConvRowProps {
  conv: Conversation
  tree?: MiniTree
  color: string
  onOpen: () => void
  onContext: (x: number, y: number) => void
}

function ConvRow({ conv, tree, color, onOpen, onContext }: ConvRowProps) {
  const [hover, setHover] = useState(false)
  const time = formatTime(conv.created_at)

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      onContextMenu={(e) => { e.preventDefault(); onContext(e.clientX, e.clientY) }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', conv.id)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 16px',
        cursor: 'pointer',
        borderRadius: 12,
        background: hover ? 'var(--bg-subtle)' : 'transparent',
        border: '1px solid',
        borderColor: hover ? 'var(--border)' : 'transparent',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3 }}>
          <span style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>
            {conv.name}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>{time}</span>
        </div>
        {tree && tree.count > 0 && (
          <TreeStat stats={tree} color={color} />
        )}
        {!tree && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Loading…</div>
        )}
        {tree && tree.count === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Empty conversation</div>
        )}
      </div>
      <div
        title={tree ? `${tree.count} nodes · ${tree.branches} branch${tree.branches === 1 ? '' : 'es'}` : undefined}
        style={{
          flexShrink: 0,
          width: 104, height: 60,
          borderRadius: 9,
          background: 'var(--tree-bg)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundImage: 'radial-gradient(circle, var(--grid-dot) 1px, transparent 1px)',
          backgroundSize: '11px 11px',
        }}
      >
        {tree && tree.count > 0 ? (
          <TreeThumb tree={tree} color={color} />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
            <circle cx="12" cy="6"  r="1.6" />
            <circle cx="6"  cy="18" r="1.6" />
            <circle cx="18" cy="18" r="1.6" />
            <path d="M11 7.5L7 16.5M13 7.5l4 9" />
          </svg>
        )}
      </div>
      <svg
        width="15" height="15" viewBox="0 0 15 15" fill="none"
        style={{ flexShrink: 0, color: 'var(--text-muted)', opacity: hover ? 1 : 0.35, transition: 'opacity 0.1s' }}
      >
        <path d="M5 3l5 4.5-5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ─── Settings menu ───────────────────────────────────────────────────────────

function SettingsMenu({
  onEdit, onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const item = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '8px 12px', fontSize: 13,
    color: 'var(--text-secondary)',
    background: 'transparent', border: 'none',
    cursor: 'pointer', textAlign: 'left' as const,
    borderRadius: 7,
  }
  return (
    <div
      data-settings-menu
      style={{
        position: 'absolute', top: 44, right: 0, zIndex: 60, width: 196,
        background: 'var(--modal-bg)',
        border: '1px solid var(--border)',
        borderRadius: 11,
        boxShadow: 'var(--shadow-lg)',
        padding: 5,
      }}
    >
      <button
        type="button"
        style={item}
        onClick={onEdit}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <path d="M4 20h4l10-10-4-4L4 16z" />
          <path d="M13.5 6.5l4 4" />
        </svg>
        Rename, icon &amp; color
      </button>
      <div style={{ height: 1, background: 'var(--border)', margin: '5px 8px' }} />
      <button
        type="button"
        style={{ ...item, color: 'var(--color-error)' }}
        onClick={onDelete}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-bg)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" />
        </svg>
        Delete project
      </button>
    </div>
  )
}

// ─── Tree builder ────────────────────────────────────────────────────────────

// Collapse the raw user/assistant rows into prompt+answer pairs, mirroring the
// full canvas (buildPairs in TreePanel) so the count, branch count and thumbnail
// shape all treat one exchange as a single node.
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
  for (const n of nodes) {
    childCount.set(n.parent, (childCount.get(n.parent) ?? 0) + 1)
  }
  let branches = 0
  for (const [parent, count] of childCount) {
    if (parent !== null && count > 1) branches += 1
  }
  return { nodes, count: nodes.length, branches }
}
