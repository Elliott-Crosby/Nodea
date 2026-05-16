'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useApp, MODELS, type AttachmentItem, type ChatMessage } from './App'

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Inline markdown renderer ──────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  if (!text) return null
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*|`([^`\n]+)`)/g
  const parts: React.ReactNode[] = []
  let last = 0
  let ki = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={ki++}>{text.slice(last, m.index)}</span>)
    const [, , boldItalic, bold, strike, italic, code] = m
    if (boldItalic !== undefined) parts.push(<strong key={ki++}><em>{boldItalic}</em></strong>)
    else if (bold !== undefined) parts.push(<strong key={ki++}>{bold}</strong>)
    else if (strike !== undefined) parts.push(<del key={ki++}>{strike}</del>)
    else if (italic !== undefined) parts.push(<em key={ki++}>{italic}</em>)
    else if (code !== undefined) parts.push(<code key={ki++}>{code}</code>)
    last = m.index + m[0].length
  }

  if (last < text.length) parts.push(<span key={ki++}>{text.slice(last)}</span>)
  if (parts.length === 0) return text
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

// ── Block markdown renderer ───────────────────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0
  let k = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) { codeLines.push(lines[i]); i++ }
      nodes.push(
        <pre key={k++}>
          {lang && <div className="code-block-header">{lang}</div>}
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      i++; continue
    }

    if (line.startsWith('#### ')) { nodes.push(<h4 key={k++}>{renderInline(line.slice(5))}</h4>); i++; continue }
    if (line.startsWith('### '))  { nodes.push(<h3 key={k++}>{renderInline(line.slice(4))}</h3>); i++; continue }
    if (line.startsWith('## '))   { nodes.push(<h2 key={k++}>{renderInline(line.slice(3))}</h2>); i++; continue }
    if (line.startsWith('# '))    { nodes.push(<h1 key={k++}>{renderInline(line.slice(2))}</h1>); i++; continue }

    if (line.startsWith('> ')) {
      const qLines = [line.slice(2)]
      while (i + 1 < lines.length && lines[i + 1].startsWith('> ')) { i++; qLines.push(lines[i].slice(2)) }
      nodes.push(<blockquote key={k++}>{qLines.map((ql, qi) => <p key={qi}>{renderInline(ql)}</p>)}</blockquote>)
      i++; continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { nodes.push(<hr key={k++} />); i++; continue }

    if (/^[-*+] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+] /.test(lines[i])) { items.push(lines[i].slice(2)); i++ }
      nodes.push(<ul key={k++}>{items.map((item, ii) => <li key={ii}>{renderInline(item)}</li>)}</ul>)
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++ }
      nodes.push(<ol key={k++}>{items.map((item, ii) => <li key={ii}>{renderInline(item)}</li>)}</ol>)
      continue
    }

    if (line.trim() === '') { i++; continue }

    const pLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^#{1,6} /.test(lines[i]) &&
      !/^[-*+] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !lines[i].startsWith('> ') &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) { pLines.push(lines[i]); i++ }

    if (pLines.length > 0) {
      nodes.push(
        <p key={k++}>
          {pLines.flatMap((pl, pi) => {
            const node = renderInline(pl)
            const frag = <React.Fragment key={`pl-${pi}`}>{node}</React.Fragment>
            return pi < pLines.length - 1 ? [frag, <br key={`br-${pi}`} />] : [frag]
          })}
        </p>
      )
    }
  }

  return <div className="md-content">{nodes}</div>
}

// ── Thinking bubble with elapsed time ────────────────────────────────────────
function ThinkingBubble() {
  const { model } = useApp()
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    setElapsed(0)
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 500)
    return () => clearInterval(id)
  }, [])

  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? 'AI'
  const status = elapsed < 5 ? 'Thinking' : elapsed < 12 ? 'Processing' : elapsed < 25 ? 'Analyzing' : 'Working on it'

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 40, flexShrink: 0 }} />
      <div
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent) 0%, #06b6d4 100%)',
          flexShrink: 0, marginTop: 5, opacity: 0.85,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', marginBottom: 5 }}>
          Claude · {modelLabel}
          {elapsed > 0 && (
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
              {status} · {elapsed}s
            </span>
          )}
        </div>
        <div
          style={{
            padding: '10px 15px', borderRadius: '4px 14px 14px 14px',
            background: 'var(--ai-card-bg)', border: '1px solid var(--ai-card-border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ display: 'inline-flex', gap: 3 }}>
            {[0, 1, 2].map((n) => (
              <span
                key={n}
                style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: `bounce 1.2s ease-in-out ${n * 0.15}s infinite`,
                  display: 'inline-block',
                }}
              />
            ))}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{status}…</span>
        </div>
      </div>
    </div>
  )
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar() {
  const { convName, setIsSearchOpen } = useApp()

  return (
    <div
      style={{
        height: 52, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--topbar-bg)', gap: 8,
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Conversations</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 1.5l3 2.5-3 2.5" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {convName}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <IconBtn title="Search (⌘K)" onClick={() => setIsSearchOpen(true)}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </IconBtn>
        <IconBtn title="Share (coming soon)" onClick={() => {}}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M10 2l3 3-3 3M13 5H6a3 3 0 0 0-3 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconBtn>
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

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', borderRadius: 7,
        cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
    >
      {children}
    </button>
  )
}

// ── Sub-header ────────────────────────────────────────────────────────────────
function SubHeader() {
  const { convName, model, setModel } = useApp()

  return (
    <div
      style={{
        padding: '14px 20px 13px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12, background: 'var(--bg-base)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {convName}
        </h1>
      </div>
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        style={{
          padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-subtle)', color: 'var(--text-primary)',
          fontSize: 12, fontWeight: 500, cursor: 'pointer', outline: 'none', flexShrink: 0,
        }}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>Model: {m.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Attachment thumbnail chip ─────────────────────────────────────────────────
function AttachmentChip({ attachment, onRemove }: { attachment: AttachmentItem; onRemove?: () => void }) {
  const isImage = attachment.type.startsWith('image/')
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: onRemove ? '3px 6px 3px 3px' : '3px 8px',
        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
        borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)',
        flexShrink: 0, maxWidth: 140,
      }}
    >
      {isImage ? (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7 1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4L7 1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {attachment.name}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 0, flexShrink: 0 }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Message ───────────────────────────────────────────────────────────────────
function Message({ msg, isLast }: { msg: ChatMessage; isLast: boolean }) {
  const { model, isLoading } = useApp()
  const isUser = msg.role === 'user'
  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? 'AI'
  const isEmptyStreaming = isLast && isLoading && !isUser && !msg.content
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isEmptyStreaming) { setElapsed(0); return }
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(id)
  }, [isEmptyStreaming])

  const images = (msg.attachments ?? []).filter((a) => a.type.startsWith('image/'))
  const files  = (msg.attachments ?? []).filter((a) => !a.type.startsWith('image/'))

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingLeft: isUser ? 48 : 0 }}>
      {!isUser && (
        <div style={{ width: 40, flexShrink: 0, textAlign: 'right', paddingTop: 9, fontSize: 10, color: 'var(--text-muted)' }}>
          {msg.timestamp ? formatTime(msg.timestamp) : ''}
        </div>
      )}

      {!isUser && (
        <div
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent) 0%, #06b6d4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 5,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.8" stroke="white" strokeWidth="1.4" />
            <path d="M7 1v1.8M7 11.2V13M1 7h1.8M11.2 7H13" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {!isUser && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Claude · {modelLabel}</span>
            {isEmptyStreaming && elapsed > 0 && (
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 10 }}>
                {elapsed < 5 ? 'Thinking' : elapsed < 12 ? 'Processing' : 'Analyzing'} · {elapsed}s
              </span>
            )}
          </div>
        )}

        {isUser && images.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
            {images.map((img) => (
              <img
                key={img.name}
                src={img.dataUrl}
                alt={img.name}
                style={{
                  maxWidth: 220, maxHeight: 180, borderRadius: 10,
                  objectFit: 'cover', border: '1px solid var(--border)',
                }}
              />
            ))}
          </div>
        )}

        {isUser && files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
            {files.map((f) => <AttachmentChip key={f.name} attachment={f} />)}
          </div>
        )}

        {(!isUser || msg.content) && (
          <div
            style={{
              maxWidth: isUser ? '76%' : '100%',
              marginLeft: isUser ? 'auto' : 0,
              padding: isUser ? '9px 14px' : '12px 15px',
              borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
              background: isUser ? 'var(--user-bubble-bg)' : 'var(--ai-card-bg)',
              border: isUser ? '1px solid var(--user-bubble-border)' : '1px solid var(--ai-card-border)',
              fontSize: 13, lineHeight: 1.65,
              color: 'var(--text-primary)', wordBreak: 'break-word',
              boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
            }}
          >
            {isUser ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
            ) : (
              msg.content
                ? <MarkdownContent content={msg.content} />
                : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {isEmptyStreaming && elapsed > 1
                      ? `${elapsed < 5 ? 'Thinking' : elapsed < 12 ? 'Processing' : 'Analyzing'}… ${elapsed}s`
                      : 'Thinking…'}
                  </span>
            )}
          </div>
        )}

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
  const { input, setInput, isLoading, handleSend, chatInputRef, pendingAttachments, addAttachment, removeAttachment } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canSend = !isLoading && (input.trim().length > 0 || pendingAttachments.length > 0)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          addAttachment({ name: file.name, type: file.type, dataUrl: reader.result as string })
          resolve()
        }
        reader.readAsDataURL(file)
      })
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [addAttachment])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div style={{ padding: '12px 20px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-base)', flexShrink: 0 }}>
      {pendingAttachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {pendingAttachments.map((a) => (
            <AttachmentChip key={a.name} attachment={a} onRemove={() => removeAttachment(a.name)} />
          ))}
        </div>
      )}

      <form
        onSubmit={handleSend}
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          background: 'var(--input-bg)', border: '1px solid var(--border)',
          borderRadius: 13, padding: '8px 8px 8px 14px',
          boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.15s',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.md"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <button
          type="button"
          title="Attach file (images, PDF, text)"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          style={{
            background: 'none', border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            color: pendingAttachments.length > 0 ? 'var(--accent)' : 'var(--text-muted)',
            padding: '0 0 2px', flexShrink: 0,
            opacity: isLoading ? 0.4 : 1,
            transition: 'color 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8.5l-6.5 6.5A4 4 0 0 1 1.9 9.4l7.1-7.1a2.5 2.5 0 0 1 3.5 3.5L5.4 12.9a1 1 0 0 1-1.4-1.4L10.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <textarea
          ref={chatInputRef}
          value={input}
          rows={1}
          onChange={(e) => {
            setInput(e.target.value)
            autoResize(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) {
                const form = e.currentTarget.closest('form')
                form?.requestSubmit()
              }
            }
          }}
          placeholder="Message Claude… (Enter to send, Shift+Enter for newline)"
          disabled={isLoading}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 13, color: 'var(--text-primary)', resize: 'none',
            lineHeight: 1.5, maxHeight: 160, overflowY: 'auto',
            fontFamily: 'inherit',
          }}
        />

        <button
          type="submit"
          disabled={!canSend}
          style={{
            width: 34, height: 34, borderRadius: 9,
            background: canSend ? 'var(--accent)' : 'var(--bg-muted)',
            border: 'none', cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M13 1L1 5.5l5 1.5 1.5 5L13 1z" stroke={canSend ? 'white' : 'var(--text-muted)'} strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  )
}

// ── Chat panel ────────────────────────────────────────────────────────────────
export default function ChatPanel() {
  const { messages, isLoading, activeConvId, createConversation, chatError, clearChatError, saveError, clearSaveError } = useApp()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showThinkingBubble = isLoading && messages[messages.length - 1]?.role !== 'assistant'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <TopBar />
      <SubHeader />

      {/* Save error banner */}
      {saveError && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 20px',
            background: 'var(--color-error-bg)',
            borderBottom: '1px solid var(--color-error-border)',
            fontSize: 12, color: 'var(--color-error)',
            flexShrink: 0,
          }}
        >
          <span>Message sent but could not be saved to history.</span>
          <button
            onClick={clearSaveError}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: '0 0 0 12px', fontSize: 12 }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1, overflowY: 'auto', padding: '24px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* ── Empty state: no conversation selected ── */}
        {!activeConvId ? (
          <div
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 16, minHeight: 300, textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--accent-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                No conversation selected
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Start a new conversation to begin chatting with Claude.
              </div>
              <button
                onClick={createConversation}
                style={{
                  padding: '9px 22px',
                  borderRadius: 10,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                New Conversation
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          /* ── Empty state: conversation exists but no messages ── */
          <div
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12, minHeight: 300, textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--bg-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4 }}>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Send your first message
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Or hover a tree node and click &ldquo;Branch here&rdquo; to fork from any point.
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <Message key={msg.id} msg={msg} isLast={i === messages.length - 1} />
          ))
        )}

        {showThinkingBubble && <ThinkingBubble />}

        {/* Chat error banner */}
        {chatError && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--color-error-bg)',
              border: '1px solid var(--color-error-border)',
              borderRadius: 10,
              fontSize: 12, color: 'var(--color-error)',
            }}
          >
            <span>{chatError}</span>
            <button
              onClick={clearChatError}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-error)', padding: '0 0 0 12px',
                fontSize: 12, fontWeight: 500, flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <InputBar />

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
