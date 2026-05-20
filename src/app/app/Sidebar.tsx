'use client'

import { useState, useRef } from 'react'
import { useApp } from './App'

export default function Sidebar() {
  const {
    conversations, activeConvId, switchConversation, createConversation,
    setIsSettingsOpen, signOut, userEmail, userName, isAdmin, isPro,
    renameConversation, deleteConversation,
  } = useApp()

  const [collapsed, setCollapsed] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const initial = (userName || userEmail || 'U').charAt(0).toUpperCase()

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditingName(name)
    setConfirmDeleteId(null)
    setTimeout(() => editInputRef.current?.select(), 0)
  }

  function commitEdit(id: string) {
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== conversations.find(c => c.id === id)?.name) {
      renameConversation(id, trimmed)
    }
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function confirmDelete(id: string) {
    setConfirmDeleteId(id)
    setEditingId(null)
  }

  function cancelDelete() {
    setConfirmDeleteId(null)
  }

  async function doDelete(id: string) {
    setConfirmDeleteId(null)
    await deleteConversation(id)
  }

  return (
    <div
      style={{
        width: collapsed ? 54 : 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Logo + collapse toggle ── */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 0 0 14px' : '0 8px 0 16px',
          borderBottom: '1px solid var(--border)',
          justifyContent: 'space-between',
          gap: 6,
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: collapsed ? 15 : 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', whiteSpace: 'nowrap', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {collapsed ? 'N' : 'Nodea'}
          {!collapsed && isAdmin && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 5px', opacity: 0.7 }}>
              ADMIN
            </span>
          )}
          {!collapsed && !isAdmin && isPro && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#a855f7', border: '1px solid #a855f7', borderRadius: 4, padding: '1px 5px', opacity: 0.85 }}>
              PRO
            </span>
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

      {/* ── New conversation button ── */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <button
          onClick={createConversation}
          title="New Conversation"
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
          {!collapsed && 'New Conversation'}
        </button>
      </div>

      {/* ── Conversation list ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '2px 0' }}>
        {conversations.map((conv) => {
          const active = conv.id === activeConvId
          const isEditing = editingId === conv.id
          const isConfirmingDelete = confirmDeleteId === conv.id
          const isHovered = hoveredId === conv.id

          return (
            <div
              key={conv.id}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ position: 'relative' }}
            >
              {isEditing && !collapsed ? (
                /* ── Inline rename input ── */
                <div style={{ padding: '4px 10px' }}>
                  <input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => commitEdit(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(conv.id) }
                      if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
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
              ) : isConfirmingDelete && !collapsed ? (
                /* ── Inline delete confirmation ── */
                <div
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-subtle)',
                    borderLeft: '2.5px solid var(--color-error)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Delete &ldquo;{conv.name}&rdquo;?
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => doDelete(conv.id)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 5,
                        border: 'none',
                        background: 'var(--color-error)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={cancelDelete}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 5,
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal conversation row ── */
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!isEditing && !isConfirmingDelete) switchConversation(conv.id)
                  }}
                  onDoubleClick={() => !collapsed && startEdit(conv.id, conv.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!isEditing && !isConfirmingDelete) switchConversation(conv.id)
                    }
                  }}
                  title={collapsed ? conv.name : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 9, width: '100%',
                    padding: collapsed ? '10px 0' : '8px 14px',
                    background: active ? 'var(--accent-bg)' : 'transparent',
                    borderLeft: !collapsed ? (active ? '2.5px solid var(--accent)' : '2.5px solid transparent') : 'none',
                    cursor: 'pointer', textAlign: 'left',
                    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: active ? 500 : 400,
                    overflow: 'hidden',
                    transition: 'background 0.1s, color 0.1s',
                    paddingRight: (!collapsed && isHovered) ? '6px' : (!collapsed ? '14px' : '0'),
                    boxSizing: 'border-box',
                    userSelect: 'none',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-subtle)' }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = active ? 'var(--accent-bg)' : 'transparent' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>
                    <path d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  {!collapsed && (
                    <>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {conv.name}
                      </span>
                      {isHovered && (
                        <button
                          onClick={(e) => { e.stopPropagation(); confirmDelete(conv.id) }}
                          title="Delete conversation"
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
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-bg)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M1 2.5h9M4 2.5V1.5h3v1M2 2.5l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Bottom: settings + user ── */}
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
              <rect x="1" y="8" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="5.5" y="5" width="3" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="10" y="1" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {!collapsed && 'Analytics'}
          </a>
        )}
        <button
          onClick={() => setIsSettingsOpen(true)}
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail}
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
