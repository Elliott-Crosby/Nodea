'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useApp, type AttachmentItem, type ChatMessage } from './App'
import { modelDisplayName } from '@/lib/models'

// ── Accepted file types (Claude API limits) ───────────────────────────────────
const ACCEPTED_MIME_TYPES: Record<string, string> = {
  'image/jpeg':       'JPEG image',
  'image/png':        'PNG image',
  'image/gif':        'GIF image',
  'image/webp':       'WebP image',
  'application/pdf':  'PDF document',
  'text/plain':       'Text file',
  'text/csv':         'CSV file',
  'text/markdown':    'Markdown file',
  'application/json': 'JSON file',
}
const ACCEPT_STRING = Object.keys(ACCEPTED_MIME_TYPES).join(',')

// Max sizes (bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_PDF_SIZE   = 32 * 1024 * 1024
const MAX_TEXT_SIZE  = 2 * 1024 * 1024

// Extension → MIME fallback (for OneDrive and other sources that drop MIME type)
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain', csv: 'text/csv',
  md: 'text/markdown', markdown: 'text/markdown',
  json: 'application/json',
}

function resolveType(file: File): string {
  if (file.type && ACCEPTED_MIME_TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_MIME[ext] ?? file.type
}

function fileSizeLimit(type: string): number {
  if (type.startsWith('image/')) return MAX_IMAGE_SIZE
  if (type === 'application/pdf') return MAX_PDF_SIZE
  return MAX_TEXT_SIZE
}

async function processFiles(
  files: FileList | File[] | null,
  addAttachment: (a: AttachmentItem) => void,
): Promise<string | null> {
  if (!files) return null
  for (const file of Array.from(files)) {
    const mimeType = resolveType(file)
    if (!ACCEPTED_MIME_TYPES[mimeType]) continue
    if (file.size > fileSizeLimit(mimeType)) {
      const mb = (fileSizeLimit(mimeType) / 1024 / 1024).toFixed(0)
      return `"${file.name}" exceeds the ${mb} MB limit for ${ACCEPTED_MIME_TYPES[mimeType]}s.`
    }
    await new Promise<void>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        addAttachment({ name: file.name, type: mimeType, dataUrl: reader.result as string })
        resolve()
      }
      reader.readAsDataURL(file)
    })
  }
  return null
}

// Collect real File objects from a drop event, handling OneDrive/cloud-only quirks
function extractDroppedFiles(e: React.DragEvent): { files: File[]; hadUriOnly: boolean } {
  const files: File[] = []

  // Try DataTransferItemList first — more reliable than .files for synced cloud drives
  if (e.dataTransfer.items) {
    for (const item of Array.from(e.dataTransfer.items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile()
        if (f && f.size > 0) files.push(f)
      }
    }
  }

  // Fallback to .files (some browsers only populate one or the other)
  if (files.length === 0) {
    for (const f of Array.from(e.dataTransfer.files)) {
      if (f.size > 0) files.push(f)
    }
  }

  // If still empty, check if this was a URI-only drop (cloud-only file)
  const types = Array.from(e.dataTransfer.types)
  const hadUriOnly = files.length === 0 &&
    (types.includes('text/uri-list') || types.includes('Files'))

  return { files, hadUriOnly }
}

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
          Claude
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
  const { convName } = useApp()

  return (
    <div
      style={{
        padding: '14px 20px 13px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--bg-base)',
      }}
    >
      <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {convName}
      </h1>
    </div>
  )
}

// ── Attachment thumbnail chip ─────────────────────────────────────────────────
function fileTypeBadge(mimeType: string): { label: string; bg: string } {
  if (mimeType === 'application/pdf')  return { label: 'PDF', bg: '#ef4444' }
  if (mimeType === 'text/csv')         return { label: 'CSV', bg: '#22c55e' }
  if (mimeType === 'application/json') return { label: 'JSON', bg: '#3b82f6' }
  if (mimeType === 'text/markdown')    return { label: 'MD',   bg: '#8b5cf6' }
  if (mimeType === 'text/plain')       return { label: 'TXT',  bg: '#6b7280' }
  return { label: 'FILE', bg: '#6b7280' }
}

function AttachmentChip({ attachment, onRemove }: { attachment: AttachmentItem; onRemove?: () => void }) {
  const isImage = attachment.type.startsWith('image/')
  const badge   = !isImage ? fileTypeBadge(attachment.type) : null
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: onRemove ? '3px 6px 3px 3px' : '3px 8px',
        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
        borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)',
        flexShrink: 0, maxWidth: 160,
      }}
    >
      {isImage ? (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 28, height: 22, borderRadius: 4, background: badge!.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: badge!.label.length > 3 ? 7 : 8, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
            {badge!.label}
          </span>
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
function Message({ msg, isLast, isHighlighted }: { msg: ChatMessage; isLast: boolean; isHighlighted: boolean }) {
  const { isLoading } = useApp()
  const isUser = msg.role === 'user'
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
    <div
      data-highlighted-msg={isHighlighted ? 'true' : undefined}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingLeft: isUser ? 48 : 0 }}
    >
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
            <span>Claude{msg.modelId ? ` · ${modelDisplayName(msg.modelId)}` : ''}</span>
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
              border: isUser && isHighlighted
                ? '1px solid var(--accent)'
                : isUser ? '1px solid var(--user-bubble-border)' : '1px solid var(--ai-card-border)',
              fontSize: 13, lineHeight: 1.65,
              color: 'var(--text-primary)', wordBreak: 'break-word',
              boxShadow: isUser && isHighlighted
                ? '0 0 0 3px var(--accent-bg)'
                : isUser ? 'none' : 'var(--shadow-sm)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
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
function InputBar({ onFileError }: { onFileError: (msg: string) => void }) {
  const { input, setInput, isLoading, handleSend, chatInputRef, pendingAttachments, addAttachment, removeAttachment, activeConvId } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canSend = !isLoading && (input.trim().length > 0 || pendingAttachments.length > 0)

  const focusAtEnd = useCallback(() => {
    const el = chatInputRef.current
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, [chatInputRef])

  // Auto-focus on mount
  useEffect(() => { focusAtEnd() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-focus when conversation switches
  useEffect(() => { if (activeConvId !== null) focusAtEnd() }, [activeConvId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tab anywhere → jump to textarea at end
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Tab' && document.activeElement !== chatInputRef.current) {
        e.preventDefault()
        focusAtEnd()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusAtEnd, chatInputRef])

  const handleFiles = useCallback(async (files: FileList | null) => {
    const err = await processFiles(files, addAttachment)
    if (err) onFileError(err)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [addAttachment, onFileError])

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
        onClick={(e) => { if (e.target === e.currentTarget) focusAtEnd() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--input-bg)', border: '1px solid var(--border)',
          borderRadius: 13, padding: '8px 8px 8px 14px',
          boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.15s',
          cursor: 'text',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
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
            padding: 0, flexShrink: 0,
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
  const { messages, isLoading, activeConvId, createConversation, chatError, clearChatError, saveError, clearSaveError, highlightedMessageId, addAttachment } = useApp()
  const bottomRef    = useRef<HTMLDivElement>(null)
  const dragCounter  = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError,  setFileError]  = useState<string | null>(null)

  useEffect(() => {
    if (highlightedMessageId) {
      const el = document.querySelector('[data-highlighted-msg="true"]')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, highlightedMessageId])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)

    const { files, hadUriOnly } = extractDroppedFiles(e)

    if (files.length === 0) {
      if (hadUriOnly) {
        setFileError(
          'File not available locally — it may be cloud-only. In OneDrive, right-click it and choose "Always keep on this device", then drop it again.'
        )
      }
      return
    }

    const err = await processFiles(files, addAttachment)
    if (err) setFileError(err)
  }, [addAttachment])

  const showThinkingBubble = isLoading && messages[messages.length - 1]?.role !== 'assistant'

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)', position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'var(--accent-bg)',
            border: '2px dashed var(--accent)',
            borderRadius: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, pointerEvents: 'none',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7 }}>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83L15 6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-text)' }}>Drop to attach</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Images, PDF, text, CSV, JSON</span>
        </div>
      )}

      {/* File error banner */}
      {fileError && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 20px', background: 'var(--color-error-bg)',
            borderBottom: '1px solid var(--color-error-border)',
            fontSize: 12, color: 'var(--color-error)', flexShrink: 0,
          }}
        >
          <span>{fileError}</span>
          <button
            onClick={() => setFileError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: '0 0 0 12px', fontSize: 12 }}
          >
            Dismiss
          </button>
        </div>
      )}

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
            <Message key={msg.id} msg={msg} isLast={i === messages.length - 1} isHighlighted={msg.id === highlightedMessageId} />
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

      <InputBar onFileError={setFileError} />

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
