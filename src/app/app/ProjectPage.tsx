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
import { ProjectIcon, colorById, MAX_PROJECT_MEMORY_LENGTH } from './projectConstants'
import TreeThumb, { TreeStat, type MiniTree } from './TreeThumb'
import { ACCEPT_STRING, MAX_FOLDER_FILES, MAX_ADMIN_FOLDER_FILES, processFiles, extractDroppedFiles, AttachmentChip, ClearAttachmentsButton } from './ChatPanel'
import type { AttachmentItem, Conversation } from './App'
import type { ChatProject } from './chatProjectTypes'

interface Props {
  project: ChatProject
  conversations: Conversation[]
  /** Folder drops are Pro-gated; admins get a larger file cap. */
  isPro: boolean
  isAdmin: boolean
  onBack: () => void
  onOpenConv: (id: string) => void
  onNewChat: (initialMessage?: string, attachments?: AttachmentItem[]) => void
  onConvContext: (conv: Conversation, x: number, y: number) => void
  onEdit: () => void
  onDelete: () => void
  /** Persist the project's memory box. Rejects on failure so the editor can
   *  keep its draft and surface the error. */
  onSaveMemory: (memory: string) => Promise<void>
  /** Open the share modal for this project. */
  onShare: () => void
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
  project, conversations, isPro, isAdmin,
  onBack, onOpenConv, onNewChat, onConvContext, onEdit, onDelete, onSaveMemory,
  onShare,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const c = colorById(project.color)
  // Shared-with-me projects belong to someone else: settings, deletion and the
  // memory box stay the owner's (the API enforces this server-side too).
  const isOwner = !project.shared
  const convs = useMemo(
    () => conversations
      .filter((cv) => cv.chat_project_id === project.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [conversations, project.id],
  )

  const [trees, setTrees] = useState<TreeMap>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [draft, setDraft] = useState('')
  // Attachments staged on the first prompt — carried into the new conversation's
  // composer and sent with the opening message (see requestNewChatInProject).
  const [atts, setAtts] = useState<AttachmentItem[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addAttachment = (a: AttachmentItem) => setAtts((prev) => [...prev, a])
  const removeAttachment = (name: string) => setAtts((prev) => prev.filter((a) => a.name !== name))

  async function handleFiles(files: FileList | File[] | null) {
    const err = await processFiles(files, addAttachment)
    setFileError(err)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  // Below ~880px the 320px memory rail can't sit beside the conversations, so we
  // stack it inline (above the conversation list) rather than letting flex-wrap
  // push it off the bottom of the page where it looks like it's gone.
  const screenRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)

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

  // Track panel width so the memory rail can reflow inline instead of wrapping
  // off the bottom of the page on narrower windows.
  useEffect(() => {
    const el = screenRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = (w: number) => setNarrow(w < 880)
    measure(el.clientWidth)
    const ro = new ResizeObserver((entries) => measure(entries[0]?.contentRect.width ?? el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = draft.trim()
    if (!text && atts.length === 0) return
    onNewChat(text || undefined, atts.length > 0 ? atts : undefined)
    setDraft('')
    setAtts([])
    setFileError(null)
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const cap = isAdmin ? MAX_ADMIN_FOLDER_FILES : MAX_FOLDER_FILES
    const { files, hadUriOnly, truncated, blockedFolder } = await extractDroppedFiles(e, {
      maxFiles: cap,
      allowFolders: isPro,
    })
    if (files.length === 0) {
      if (blockedFolder) {
        setFileError('Dropping a whole folder is a Pro feature. Upgrade to attach folders, or drop individual files.')
      } else if (hadUriOnly) {
        setFileError('That file could not be read. If it’s a cloud-only OneDrive file, open it once so Windows downloads a local copy, then drop it again.')
      }
      return
    }
    const err = await processFiles(files, addAttachment)
    if (err) setFileError(err)
    else if (blockedFolder) setFileError('Folders are a Pro feature — attached the loose files only. Upgrade to include whole folders.')
    else if (truncated) setFileError(`Only the first ${cap} files from that folder were added.`)
    else setFileError(null)
  }

  return (
    <div
      ref={screenRef}
      data-screen="project-page"
      style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDragging(true) }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => { e.preventDefault(); dragDepth.current--; if (dragDepth.current === 0) setDragging(false) }}
      onDrop={onDrop}
    >
      {/* Whole-screen drop overlay — drop a file or folder anywhere on the page,
          not just into the prompt box. */}
      {dragging && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'var(--accent-bg)',
            border: `2px dashed ${c.hex}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, pointerEvents: 'none',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.75 }}>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83L15 6" stroke={c.hex} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Drop to attach</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Images, PDF, text, CSV, JSON{isPro ? ' — or a whole folder' : ''}
          </span>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Colored top strip echoing the project color */}
      <div style={{ height: 3, background: c.hex }} />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 32px 48px' }}>
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

        {/* Two-column body — conversations on the left, project memory on the right (Claude-style) */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        {/* ── Main column ── */}
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>

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
              {project.shared && (
                <> · shared by <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{project.owner_name ?? 'a teammate'}</strong></>
              )}
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
            type="button"
            onClick={onShare}
            title="Share this project"
            style={{
              display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 13px', flexShrink: 0,
              background: project.shared ? 'var(--accent-bg)' : 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 9, cursor: 'pointer',
              color: project.shared ? 'var(--accent-text)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.6 10.7l6.8-3.9M8.6 13.3l6.8 3.9" />
            </svg>
            {project.shared ? 'Shared' : 'Share'}
          </button>

          {isOwner && (
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
          )}

          {menuOpen && isOwner && (
            <SettingsMenu
              onEdit={() => { setMenuOpen(false); onEdit() }}
              onDelete={() => { setMenuOpen(false); onDelete() }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>

        {/* Prominent new-chat input — accepts attachments dropped or picked here,
            which ride along with the opening message into the new conversation. */}
        <div style={{ marginBottom: 28 }}>
          <form
            onSubmit={submit}
            style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              padding: '8px 8px 8px 8px',
              background: 'var(--input-bg)',
              border: '1.5px solid var(--border)',
              borderRadius: 13,
              boxShadow: 'var(--shadow-sm)',
              transition: 'border-color 0.15s',
            }}
            onFocusCapture={(e) => { (e.currentTarget as HTMLFormElement).style.borderColor = c.hex }}
            onBlurCapture={(e) => { (e.currentTarget as HTMLFormElement).style.borderColor = 'var(--border)' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_STRING}
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />

            {atts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '2px 4px 0' }}>
                {atts.map((a) => (
                  <AttachmentChip key={a.name} attachment={a} onRemove={() => removeAttachment(a.name)} />
                ))}
                {atts.length > 1 && (
                  <ClearAttachmentsButton count={atts.length} onClear={() => setAtts([])} />
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 20, height: 20, borderRadius: 6,
                background: c.soft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginLeft: 8,
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
                type="button"
                title="Attach file (images, PDF, text)"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  border: 'none', cursor: 'pointer',
                  background: 'transparent',
                  color: atts.length > 0 ? c.hex : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8.5l-6.5 6.5A4 4 0 0 1 1.9 9.4l7.1-7.1a2.5 2.5 0 0 1 3.5 3.5L5.4 12.9a1 1 0 0 1-1.4-1.4L10.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
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
            </div>
          </form>
          {fileError && (
            <div style={{ fontSize: 12, color: 'var(--color-error)', margin: '8px 2px 0' }}>
              {fileError}
            </div>
          )}
        </div>

        {/* Memory — stacked inline on narrow widths so it never gets buried */}
        {narrow && (
          <div style={{ marginBottom: 22 }}>
            <MemoryBox project={project} color={c} onSave={onSaveMemory} readOnly={!isOwner} />
          </div>
        )}

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
              Connected canvas (coming soon)
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.45 }}>
              Soon you&rsquo;ll see every conversation in this project laid out as one connected tree.
            </div>
          </div>
        </div>
        {/* end main column */}
        </div>

        {/* ── Right column: project memory rail (Claude-style), wide screens only ── */}
        {!narrow && (
          <aside style={{
            flex: '0 0 320px',
            position: 'sticky', top: 24,
          }}>
            <MemoryBox project={project} color={c} onSave={onSaveMemory} readOnly={!isOwner} />
          </aside>
        )}
        {/* end two-column body */}
        </div>
      </div>
      {/* end inner scroll container */}
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

// ─── Memory box — editable per-project context ───────────────────────────────
// A project's `memory` is injected into the system prompt for every chat in the
// project (Pro-gated, server-side). Edited inline here: view → Edit → Save.

function MemoryBox({
  project, color, onSave, readOnly,
}: {
  project: ChatProject
  color: ReturnType<typeof colorById>
  onSave: (memory: string) => Promise<void>
  /** Shared-with-me project: the memory belongs to the owner; no edit pencil. */
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(project.memory ?? '')
  const [saving, setSaving]   = useState(false)
  const [failed, setFailed]   = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Stay in sync with the saved value whenever we're not mid-edit (e.g. the
  // project reloaded, or it was changed in another tab).
  useEffect(() => {
    if (!editing) setDraft(project.memory ?? '')
  }, [project.memory, editing])

  // Focus + place the caret at the end when entering edit mode.
  useEffect(() => {
    if (editing && taRef.current) {
      const el = taRef.current
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing])

  function startEdit() {
    setDraft(project.memory ?? '')
    setFailed(false)
    setEditing(true)
  }
  function cancel() {
    setEditing(false)
    setFailed(false)
    setDraft(project.memory ?? '')
  }
  async function save() {
    if (saving) return
    setSaving(true)
    setFailed(false)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const memory = (project.memory ?? '').trim()

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 14,
      background: 'var(--bg-subtle)',
      padding: '15px 16px',
    }}>
      {/* Header: title · "Only you" pill · edit pencil */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: editing || memory ? 12 : 10 }}>
        <span style={{
          flex: 1, minWidth: 0,
          fontSize: 14.5, fontWeight: 650,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
        }}>
          Memory
        </span>
        {!editing && (
          <>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 999,
              fontSize: 11, fontWeight: 500,
              color: 'var(--text-muted)',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              {readOnly ? 'Owner only' : 'Only you'}
            </span>
            {!readOnly && <button
              type="button"
              onClick={startEdit}
              title={memory ? 'Edit memory' : 'Add memory'}
              aria-label={memory ? 'Edit memory' : 'Add memory'}
              style={{
                width: 28, height: 28, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', borderRadius: 7,
                cursor: 'pointer', color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--bg-muted)'; b.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = 'var(--text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h4l10-10-4-4L4 16z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
            </button>}
          </>
        )}
      </div>

      {/* Body */}
      {editing ? (
        <>
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_PROJECT_MEMORY_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancel() }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() }
            }}
            rows={7}
            placeholder="Context Nodea should remember for every chat in this project: goals, preferences, tone, key facts…"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 9,
              fontSize: 13,
              lineHeight: 1.55,
              border: '1px solid var(--border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 150,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 10 }}>
            <span style={{ fontSize: 11, color: failed ? 'var(--color-error)' : 'var(--text-muted)' }}>
              {failed
                ? "Couldn't save. Try again."
                : `${draft.length} / ${MAX_PROJECT_MEMORY_LENGTH}`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                style={{
                  padding: '7px 13px', borderRadius: 8,
                  fontSize: 12.5, fontWeight: 500,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                style={{
                  padding: '7px 15px', borderRadius: 8,
                  fontSize: 12.5, fontWeight: 600,
                  border: 'none',
                  background: saving ? 'var(--bg-muted)' : color.hex,
                  color: saving ? 'var(--text-muted)' : '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </>
      ) : memory ? (
        <>
          <p style={{
            margin: 0,
            fontSize: 12.5, lineHeight: 1.55,
            color: 'var(--text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}>
            {memory}
          </p>
          {project.updated_at && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              Last updated {formatTime(project.updated_at)}
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          style={{
            width: '100%', textAlign: 'left',
            padding: '11px 12px',
            borderRadius: 9,
            border: '1px dashed var(--border-strong)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 12, lineHeight: 1.5,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          Add context Nodea should keep in mind for every chat in this project.
        </button>
      )}
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
