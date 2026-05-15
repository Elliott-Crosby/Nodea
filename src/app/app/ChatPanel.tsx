'use client'

import { useEffect, useRef } from 'react'
import { useApp, MODELS } from './App'

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function TopBar() {
  const { convName, setIsSearchOpen, setIsSettingsOpen } = useApp()

  return (
    <div
      style={{
        height: 52,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--topbar-bg)',
        gap: 8,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Conversations</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 1.5l3 2.5-3 2.5" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {convName}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* Search */}
        <IconBtn title="Search" onClick={() => setIsSearchOpen(true)}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </IconBtn>

        {/* Share (placeholder) */}
        <IconBtn title="Share (coming soon)" onClick={() => {}}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M10 2l3 3-3 3M13 5H6a3 3 0 0 0-3 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconBtn>

        {/* More (placeholder) */}
        <IconBtn title="More options" onClick={() => {}}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="3" cy="7.5" r="1.2" fill="currentColor" />
            <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" />
            <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
          </svg>
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

// ── Sub-header (title + model selector) ──────────────────────────────────────

function SubHeader() {
  const { convName, model, setModel } = useApp()

  return (
    <div
      style={{
        padding: '14px 20px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        background: 'var(--bg-base)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {convName}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Active conversation · click a tree node to branch
        </p>
      </div>

      {/* Model selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            padding: '5px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              Model: {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── Message bubbles ───────────────────────────────────────────────────────────

function Message({ msg }: { msg: { id: string; role: string; content: string; timestamp: number } }) {
  const isUser = msg.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: isUser ? '0 0 0 48px' : '0',
      }}
    >
      {/* Timestamp (left) */}
      <div
        style={{
          width: 48,
          flexShrink: 0,
          textAlign: 'right',
          paddingTop: 10,
          fontSize: 10,
          color: 'var(--text-muted)',
          display: isUser ? 'none' : 'block',
        }}
      >
        {msg.timestamp ? formatTime(msg.timestamp) : ''}
      </div>

      {/* AI avatar */}
      {!isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent) 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" stroke="white" strokeWidth="1.4" />
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Role label */}
        {!isUser && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', marginBottom: 4 }}>
            Claude · {MODELS.find(() => true)?.label ?? 'AI'}
          </div>
        )}

        {/* Bubble / card */}
        <div
          style={{
            maxWidth: isUser ? '75%' : '100%',
            marginLeft: isUser ? 'auto' : 0,
            padding: isUser ? '9px 14px' : '12px 16px',
            borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
            background: isUser ? 'var(--user-bubble-bg)' : 'var(--ai-card-bg)',
            border: isUser
              ? '1px solid var(--user-bubble-border)'
              : '1px solid var(--ai-card-border)',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
          }}
        >
          {msg.content || (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Thinking…</span>
          )}
        </div>

        {/* User timestamp (right) */}
        {isUser && msg.timestamp && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 3 }}>
            {formatTime(msg.timestamp)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Input bar ─────────────────────────────────────────────────────────────────

function InputBar() {
  const { input, setInput, isLoading, handleSend } = useApp()

  return (
    <div
      style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-base)',
        flexShrink: 0,
      }}
    >
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--input-bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '8px 8px 8px 14px',
        }}
      >
        {/* Attachment placeholder */}
        <button
          type="button"
          title="Attach file (coming soon)"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'not-allowed',
            color: 'var(--text-muted)',
            padding: 0,
            flexShrink: 0,
            opacity: 0.5,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M14 8.5l-6.5 6.5A4 4 0 0 1 1.9 9.4l7.1-7.1a2.5 2.5 0 0 1 3.5 3.5L5.4 12.9a1 1 0 0 1-1.4-1.4L10.5 5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything, or type /branch"
          disabled={isLoading}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: isLoading || !input.trim() ? 'var(--text-muted)' : 'var(--accent)',
            border: 'none',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M13 1L1 5.5l5 1.5 1.5 5L13 1z"
              stroke="white"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  )
}

// ── Chat panel (assembled) ────────────────────────────────────────────────────

export default function ChatPanel() {
  const { messages, isLoading } = useApp()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopBar />
      <SubHeader />

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              textAlign: 'center',
              gap: 8,
              minHeight: 200,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.3 }}>
              <path
                d="M4 4h24a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10l-6 4V6a2 2 0 0 1 2-2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span>Start a conversation</span>
            <span style={{ fontSize: 12 }}>Click a tree node to branch from that point</span>
          </div>
        ) : (
          messages.map((msg) => <Message key={msg.id} msg={msg} />)
        )}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 48, flexShrink: 0 }} />
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent) 0%, #06b6d4 100%)',
                flexShrink: 0,
                marginTop: 6,
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
            />
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '4px 14px 14px 14px',
                background: 'var(--ai-card-bg)',
                border: '1px solid var(--ai-card-border)',
                fontSize: 13,
                color: 'var(--text-muted)',
              }}
            >
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <InputBar />
    </div>
  )
}
