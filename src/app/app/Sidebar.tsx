'use client'

import { useState, useRef, useEffect } from 'react'
import { track } from '@vercel/analytics'
import { useApp } from './App'
import { trackEvent } from '@/lib/track-event'
import { ProjectIcon, colorById, MAX_PINNED_PROJECTS } from './projectConstants'

const MIN_WIDTH     = 200
const MAX_WIDTH     = 480
const DEFAULT_WIDTH = 268
const STORAGE_KEY   = 'nodea:sidebarWidth'

export default function Sidebar() {
  const {
    conversations, activeConvId, inFlightConvIds, switchConversation, createConversation,
    setIsSettingsOpen, signOut, userEmail, userName, isAdmin, isPro,
    renameConversation,
    setIsUpgradeOpen,
    // ── Projects feature ──
    chatProjects, activeChatProjectId, view,
    openProjectsLanding, openProject, openNewProjectModal,
    openConvContext, openProjectContext, openChatView,
    assignConvToProject, requestNewChatInProject,
  } = useApp()

  const [collapsed, setCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [dropTargetProject, setDropTargetProject] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const isResizing   = useRef(false)
  const resizeOrigin = useRef({ x: 0, w: DEFAULT_WIDTH })

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const n = parseInt(saved, 10)
      if (Number.isFinite(n)) setPanelWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n)))
    }
  }, [])

  const [resizing, setResizing] = useState(false)

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isResizing.current   = true
    resizeOrigin.current = { x: e.clientX, w: panelWidth }
    setResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    let finalWidth = panelWidth
    function onMove(ev: MouseEvent) {
      if (!isResizing.current) return
      const delta = ev.clientX - resizeOrigin.current.x
      finalWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeOrigin.current.w + delta))
      setPanelWidth(finalWidth)
    }
    function onUp() {
      isResizing.current = false
      setResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try { window.localStorage.setItem(STORAGE_KEY, String(finalWidth)) } catch {}
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const initial = (userName || userEmail || 'U').charAt(0).toUpperCase()

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditingName(name)
    setTimeout(() => editInputRef.current?.select(), 0)
  }

  function commitEdit(id: string) {
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== conversations.find(c => c.id === id)?.name) {
      renameConversation(id, trimmed)
    }
    setEditingId(null)
  }

  function cancelEdit() { setEditingId(null) }

  // ── Drop target factory for pinned projects ───────────────────────────────
  function dropHandlers(projectId: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropTargetProject(projectId)
      },
      onDragLeave: () => {
        setDropTargetProject((t) => (t === projectId ? null : t))
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        const convId = e.dataTransfer.getData('text/plain')
        setDropTargetProject(null)
        if (convId) assignConvToProject(convId, projectId)
      },
    }
  }

  const projectById = (id: string | null | undefined) =>
    id ? chatProjects.find((p) => p.id === id) ?? null : null

  // ── Conversation partition: inside a project, top = project's chats ──────
  const insideProject = view === 'project' && activeChatProjectId !== null
  const activeProj = projectById(activeChatProjectId)
  const topConvs = insideProject
    ? conversations.filter((c) => c.chat_project_id === activeChatProjectId)
    : []
  const restConvs = insideProject
    ? conversations.filter((c) => c.chat_project_id !== activeChatProjectId)
    : conversations

  // ── Pinned projects (cap at 3) ────────────────────────────────────────────
  const pinned = chatProjects.filter((p) => p.pinned).slice(0, MAX_PINNED_PROJECTS)

  return (
    <div
      data-sidebar-root
      style={{
        width: collapsed ? 54 : panelWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        transition: resizing ? 'none' : 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: 'absolute', right: 0, top: 0,
            width: 5, height: '100%',
            cursor: 'col-resize', zIndex: 20,
            background: 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.opacity = '0.35' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
          title="Drag to resize"
        />
      )}

      {/* Header: brand + collapse toggle */}
      <div
        style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 0 0 14px' : '0 8px 0 16px',
          borderBottom: '1px solid var(--border)',
          justifyContent: 'space-between',
          gap: 6, overflow: 'hidden',
        }}
      >
        <span style={{ whiteSpace: 'nowrap', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {!collapsed && <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>Nodea</span>}
          {!collapsed && isAdmin && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 5px', opacity: 0.7 }}>
              ADMIN
            </span>
          )}
          {!collapsed && isPro && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#a855f7', border: '1px solid #a855f7', borderRadius: 4, padding: '1px 5px', opacity: 0.85 }}>
              PRO
            </span>
          )}
          {!collapsed && !isPro && (
            <button
              onClick={() => { track('upgrade_clicked', { source: 'sidebar' }); window.location.href = '/upgrade' }}
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#a855f7', border: '1px solid #a855f7', borderRadius: 4, padding: '2px 8px', opacity: 0.85, background: 'transparent', cursor: 'pointer', lineHeight: 1 }}
            >
              UPGRADE
            </button>
          )}
        </span>

        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none',
            borderRadius: 6, cursor: 'pointer',
            color: 'var(--text-muted)',
            flexShrink: 0,
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          {collapsed ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 2L0 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            </svg>
          )}
        </button>
      </div>

      {/* New conversation button — context-aware inside a project */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <button
          onClick={() => {
            if (insideProject && activeProj) {
              requestNewChatInProject(activeProj.id)
            } else {
              createConversation()
            }
          }}
          title={insideProject && activeProj ? `New chat in ${activeProj.name}` : 'New Conversation'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 7, width: '100%',
            padding: collapsed ? '8px 0' : '7px 10px',
            background: 'var(--accent-bg)',
            border: '1px solid var(--user-bubble-border)',
            borderRadius: 8,
            fontSize: 12, fontWeight: 500, color: 'var(--accent-text)',
            cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {!collapsed && (
            insideProject && activeProj ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                New chat in&nbsp;<strong style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeProj.name}</strong>
              </span>
            ) : 'New Conversation'
          )}
        </button>
      </div>

      {/* Scrollable area: Projects + Conversations */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '2px 0' }}>
        {/* ── PROJECTS SECTION ── */}
        {!collapsed && (
          isPro ? (
            <>
              <SectionLabel
                action={(
                  <button
                    onClick={openNewProjectModal}
                    title="New project"
                    style={{
                      width: 20, height: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', borderRadius: 5,
                      cursor: 'pointer', color: 'var(--text-muted)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                      <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              >
                Projects
              </SectionLabel>

              {pinned.map((p) => (
                <PinnedProject
                  key={p.id}
                  project={p}
                  active={p.id === activeChatProjectId && view === 'project'}
                  dropActive={dropTargetProject === p.id}
                  onClick={() => openProject(p.id)}
                  onContext={(x, y) => openProjectContext(p, x, y)}
                  {...dropHandlers(p.id)}
                />
              ))}

              <button
                onClick={openProjectsLanding}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '7px 14px',
                  background: view === 'projects' ? 'var(--accent-bg)' : 'transparent',
                  border: 'none',
                  borderLeft: view === 'projects' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  color: view === 'projects' ? 'var(--accent-text)' : 'var(--text-muted)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { if (view !== 'projects') (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' }}
                onMouseLeave={(e) => { if (view !== 'projects') (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 7,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <rect x="3" y="4" width="8" height="7" rx="1.5" />
                    <rect x="13" y="4" width="8" height="7" rx="1.5" />
                    <rect x="3" y="13" width="8" height="7" rx="1.5" />
                    <rect x="13" y="13" width="8" height="7" rx="1.5" />
                  </svg>
                </span>
                See all projects
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500 }}>
                  {chatProjects.length}
                </span>
              </button>
            </>
          ) : (
            <>
              <SectionLabel>Projects</SectionLabel>
              <button
                onClick={() => { track('upgrade_clicked', { source: 'sidebar_projects' }); setIsUpgradeOpen(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '7px 14px',
                  background: 'transparent', border: 'none',
                  borderLeft: '2.5px solid transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 7,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: 'var(--text-muted)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <rect x="3" y="4" width="8" height="7" rx="1.5" />
                    <rect x="13" y="4" width="8" height="7" rx="1.5" />
                    <rect x="3" y="13" width="8" height="7" rx="1.5" />
                    <rect x="13" y="13" width="8" height="7" rx="1.5" />
                  </svg>
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Projects</span>
                <span style={{
                  marginLeft: 'auto',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                  color: '#a855f7', border: '1px solid #a855f7',
                  borderRadius: 4, padding: '1px 5px',
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  PRO
                </span>
              </button>
            </>
          )
        )}

        {/* ── CONVERSATIONS ── */}
        {insideProject && activeProj && !collapsed && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '14px 14px 6px' }}>
              <span style={{
                width: 16, height: 16, borderRadius: 5,
                background: colorById(activeProj.color).soft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ProjectIcon name={activeProj.icon} size={10} color={colorById(activeProj.color).hex} />
              </span>
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
                color: colorById(activeProj.color).hex, textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {activeProj.name}
              </span>
            </div>
            {topConvs.length ? topConvs.map((conv) => (
              <ConvRow
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeConvId}
                isGenerating={inFlightConvIds.has(conv.id)}
                isHovered={hoveredId === conv.id}
                isEditing={editingId === conv.id}
                editingName={editingName}
                editInputRef={editInputRef}
                setHovered={setHoveredId}
                setEditingName={setEditingName}
                onClick={() => { openChatView(); switchConversation(conv.id) }}
                onDoubleClick={() => startEdit(conv.id, conv.name)}
                onCommitEdit={() => commitEdit(conv.id)}
                onCancelEdit={cancelEdit}
                onContext={(x, y) => openConvContext(conv, x, y)}
                projects={chatProjects}
                collapsed={collapsed}
              />
            )) : (
              <div style={{ padding: '4px 16px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
                No conversations yet.
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 4px' }}>
              <span style={{ height: 1, background: 'var(--border)', flex: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Other conversations
              </span>
              <span style={{ height: 1, background: 'var(--border)', flex: 1 }} />
            </div>
          </>
        )}

        {!collapsed && !insideProject && (
          <SectionLabel>Recents</SectionLabel>
        )}

        {restConvs.map((conv) => (
          <ConvRow
            key={conv.id}
            conv={conv}
            isActive={conv.id === activeConvId}
            isGenerating={inFlightConvIds.has(conv.id)}
            isHovered={hoveredId === conv.id}
            isEditing={editingId === conv.id}
            editingName={editingName}
            editInputRef={editInputRef}
            setHovered={setHoveredId}
            setEditingName={setEditingName}
            onClick={() => { openChatView(); switchConversation(conv.id) }}
            onDoubleClick={() => startEdit(conv.id, conv.name)}
            onCommitEdit={() => commitEdit(conv.id)}
            onCancelEdit={cancelEdit}
            onContext={(x, y) => openConvContext(conv, x, y)}
            projects={chatProjects}
            collapsed={collapsed}
          />
        ))}
      </div>

      {/* Bottom: settings + user */}
      <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {isAdmin && (
          <a
            href="/admin"
            title="Analytics"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 9, width: '100%',
              padding: collapsed ? '10px 0' : '10px 14px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 13,
              overflow: 'hidden', whiteSpace: 'nowrap',
              textDecoration: 'none',
              transition: 'background 0.1s',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-subtle)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1"  y="8" width="3" height="5"  rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="5.5" y="5" width="3" height="8"  rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="1" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {!collapsed && 'Analytics'}
          </a>
        )}
        <button
          onClick={() => { trackEvent('settings_opened'); setIsSettingsOpen(true) }}
          title="Settings"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 9, width: '100%',
            padding: collapsed ? '10px 0' : '10px 14px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13,
            overflow: 'hidden', whiteSpace: 'nowrap',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.64 2.64l1.06 1.06M10.3 10.3l1.06 1.06M2.64 11.36l1.06-1.06M10.3 3.7l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {!collapsed && 'Settings'}
        </button>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 9, padding: collapsed ? '10px 0 14px' : '8px 14px 14px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, flexShrink: 0,
            }}
          >
            {initial}
          </div>

          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName || 'User'}
              </div>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={signOut}
              title="Sign out"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M5 1H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M9 9.5l3-3-3-3M12 6.5H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SectionLabel ────────────────────────────────────────────────────────────

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px 5px',
    }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
        color: 'var(--text-muted)', textTransform: 'uppercase',
      }}>
        {children}
      </span>
      {action}
    </div>
  )
}

// ─── PinnedProject row ──────────────────────────────────────────────────────

import type { ChatProject } from './chatProjectTypes'

interface PinnedProjectProps {
  project: ChatProject
  active: boolean
  dropActive: boolean
  onClick: () => void
  onContext: (x: number, y: number) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}

function PinnedProject({
  project, active, dropActive,
  onClick, onContext, onDragOver, onDragLeave, onDrop,
}: PinnedProjectProps) {
  const [hover, setHover] = useState(false)
  const c = colorById(project.color)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onContextMenu={(e) => { e.preventDefault(); onContext(e.clientX, e.clientY) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', margin: '1px 0',
        padding: '7px 14px',
        background: dropActive ? c.soft : (active ? 'var(--accent-bg)' : (hover ? 'var(--bg-subtle)' : 'transparent')),
        borderLeft: active ? '2.5px solid var(--accent)' : '2.5px solid transparent',
        outline: dropActive ? `1.5px dashed ${c.hex}` : 'none',
        outlineOffset: -3,
        cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.1s',
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: 7,
        background: c.soft,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ProjectIcon name={project.icon} size={13} color={c.hex} />
      </span>
      <span style={{
        flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: 13, fontWeight: active ? 600 : 500,
        color: active ? 'var(--accent-text)' : 'var(--text-primary)',
      }}>
        {project.name}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontWeight: 500 }}>
        {project.chat_count}
      </span>
    </div>
  )
}

// ─── ConvRow (extracted for reuse between inside-project and rest) ──────────

import type { Conversation } from './App'

// Source-model logo badge shown beside imported conversations.
// Each key maps to a 14×14 SVG in public/models/; add an entry here as new sources are supported.
const SOURCE_TITLES: Record<string, string> = {
  claude:     'Imported from Claude',
  chatgpt:    'Imported from ChatGPT',
  gemini:     'Imported from Gemini',
  perplexity: 'Imported from Perplexity',
  grok:       'Imported from Grok',
  copilot:    'Imported from Copilot',
  meta:       'Imported from Meta AI',
  mistral:    'Imported from Mistral',
  deepseek:   'Imported from DeepSeek',
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source || !SOURCE_TITLES[source]) return null
  return (
    <span title={SOURCE_TITLES[source]} style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/models/${source}.svg`} width={13} height={13} alt="" aria-hidden style={{ display: 'block' }} />
    </span>
  )
}

interface ConvRowProps {
  conv: Conversation
  isActive: boolean
  isGenerating: boolean
  isHovered: boolean
  isEditing: boolean
  editingName: string
  editInputRef: React.RefObject<HTMLInputElement | null>
  setHovered: (id: string | null) => void
  setEditingName: (s: string) => void
  onClick: () => void
  onDoubleClick: () => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onContext: (x: number, y: number) => void
  projects: ChatProject[]
  collapsed: boolean
}

function ConvRow(props: ConvRowProps) {
  const {
    conv, isActive, isGenerating, isHovered, isEditing,
    editingName, editInputRef, setHovered, setEditingName,
    onClick, onDoubleClick, onCommitEdit, onCancelEdit,
    onContext, projects, collapsed,
  } = props

  const project = conv.chat_project_id
    ? projects.find((p) => p.id === conv.chat_project_id) ?? null
    : null
  // The conversation's own color (if set) overrides any project-derived color.
  const ownColor = conv.color ? colorById(conv.color) : null
  const c = ownColor ?? (project ? colorById(project.color) : null)

  return (
    <div
      onMouseEnter={() => setHovered(conv.id)}
      onMouseLeave={() => setHovered(null)}
      style={{ position: 'relative' }}
    >
      {collapsed && isGenerating && (
        <span className="conv-gen-dot conv-gen-dot--collapsed" aria-label="Generating" />
      )}
      {isEditing && !collapsed ? (
        <div style={{ padding: '4px 10px' }}>
          <input
            ref={editInputRef}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { e.preventDefault(); onCommitEdit() }
              if (e.key === 'Escape') { e.preventDefault(); onCancelEdit() }
            }}
            style={{
              width: '100%',
              padding: '5px 8px',
              borderRadius: 6,
              border: '1.5px solid var(--accent)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          draggable
          onClick={onClick}
          onDoubleClick={() => !collapsed && onDoubleClick()}
          onContextMenu={(e) => { e.preventDefault(); onContext(e.clientX, e.clientY) }}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', conv.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick()
            }
          }}
          title={collapsed ? conv.name : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 9, width: '100%',
            padding: collapsed ? '10px 0' : '8px 14px',
            background: isActive ? 'var(--accent-bg)' : 'transparent',
            borderLeft: !collapsed ? (isActive ? '2.5px solid var(--accent)' : '2.5px solid transparent') : 'none',
            cursor: 'pointer', textAlign: 'left',
            color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: isActive ? 500 : 400,
            overflow: 'hidden',
            transition: 'background 0.1s, color 0.1s',
            paddingRight: (!collapsed && isHovered) ? '6px' : (!collapsed ? '14px' : '0'),
            boxSizing: 'border-box',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-subtle)' }}
          onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = isActive ? 'var(--accent-bg)' : 'transparent' }}
        >
          {/* Icon: project glyph if tagged, else chat bubble — tinted by the
              conversation's own color when set, otherwise the project color. */}
          {project && c ? (
            <ProjectIcon
              name={project.icon}
              size={16}
              color={c.hex}
              strokeWidth={1.8}
              style={{ flexShrink: 0 }}
            />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: ownColor ? 1 : (isActive ? 1 : 0.6) }}>
              <path d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1z" stroke={ownColor ? ownColor.hex : 'currentColor'} strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          )}
          {!collapsed && (
            <>
              <SourceBadge source={conv.source} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                {conv.name}
              </span>
              {isGenerating && !isHovered && (
                <span className="conv-gen-dot" aria-label="Generating" />
              )}
              {isHovered && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                    onContext(Math.max(8, r.right - 210), r.bottom + 4)
                  }}
                  title="Chat options"
                  style={{
                    flexShrink: 0,
                    width: 22, height: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                    <circle cx="7" cy="2.5" r="1.3" />
                    <circle cx="7" cy="7" r="1.3" />
                    <circle cx="7" cy="11.5" r="1.3" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
