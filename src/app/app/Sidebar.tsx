'use client'

import { useState } from 'react'
import { useApp } from './App'

export default function Sidebar() {
  const {
    conversations, activeConvId, switchConversation, createConversation,
    setIsSettingsOpen, signOut, userEmail, userName,
  } = useApp()

  const [collapsed, setCollapsed] = useState(false)
  const initial = (userName || userEmail || 'U').charAt(0).toUpperCase()

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
        {/* Logo — text only */}
        <span style={{ fontSize: collapsed ? 15 : 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', whiteSpace: 'nowrap', minWidth: 0 }}>
          {collapsed ? 'N' : 'Nodea'}
        </span>

        {/* Collapse toggle */}
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
      <div style={{ padding: collapsed ? '8px 10px' : '8px 10px', flexShrink: 0 }}>
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
          return (
            <button
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              title={conv.name}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 9, width: '100%',
                padding: collapsed ? '10px 0' : '8px 14px',
                background: active ? 'var(--accent-bg)' : 'transparent',
                border: 'none',
                borderLeft: !collapsed ? (active ? '2.5px solid var(--accent)' : '2.5px solid transparent') : 'none',
                cursor: 'pointer', textAlign: 'left',
                color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: active ? 500 : 400,
                overflow: 'hidden',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)' }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>
                <path d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              {!collapsed && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                  {conv.name}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Bottom: settings + user ── */}
      <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Settings */}
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

        {/* User */}
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
