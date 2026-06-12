'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { track } from '@vercel/analytics'
import { useApp, type AttachmentItem, type ChatMessage } from './App'
import { modelDisplayName } from '@/lib/models'
import { providerForModel, getAISource } from '@/lib/ai-sources'

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
export const ACCEPT_STRING = Object.keys(ACCEPTED_MIME_TYPES).join(',')

// Max sizes (bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_PDF_SIZE   = 32 * 1024 * 1024
const MAX_TEXT_SIZE  = 2 * 1024 * 1024

// Folder drops: cap how many files we pull in (and how deep we recurse) so a
// stray large directory can't flood the composer. Files past the cap are
// ignored and the user is told. Admins get a higher ceiling for internal use;
// raising these limits for regular users is tracked as future work.
export const MAX_FOLDER_FILES = 25        // Pro users
export const MAX_ADMIN_FOLDER_FILES = 100 // admins
const MAX_FOLDER_DEPTH = 6

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

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Vercel serverless functions cap request bodies at 4.5 MB. A few real photos
// blow past that as raw data URLs, so we downscale + re-encode large images
// client-side before they go into pendingAttachments. Animated GIFs are left
// alone (re-encoding would freeze them).
async function compressImageIfNeeded(
  file: File,
  mimeType: string,
): Promise<{ dataUrl: string; type: string }> {
  const COMPRESS_THRESHOLD = 700 * 1024 // 700 KB
  const MAX_DIMENSION      = 1600       // longest side after resize

  if (mimeType === 'image/gif' || file.size <= COMPRESS_THRESHOLD) {
    return { dataUrl: await readAsDataUrl(file), type: mimeType }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { dataUrl: await readAsDataUrl(file), type: mimeType }
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width  * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close?.(); return { dataUrl: await readAsDataUrl(file), type: mimeType } }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  // JPEG re-encodes photos far smaller than PNG; PNGs with transparency lose
  // it, but the chat flow has no use for transparency anyway.
  const outType = 'image/jpeg'
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, outType, 0.82))
  if (!blob) return { dataUrl: await readAsDataUrl(file), type: mimeType }
  return { dataUrl: await readAsDataUrl(blob), type: outType }
}

export async function processFiles(
  files: FileList | File[] | null,
  addAttachment: (a: AttachmentItem) => void,
): Promise<string | null> {
  if (!files) return null
  const skipped: string[] = []
  for (const file of Array.from(files)) {
    const mimeType = resolveType(file)
    // Folders pull in everything; quietly ignore types we can't attach.
    if (!ACCEPTED_MIME_TYPES[mimeType]) continue
    if (file.size > fileSizeLimit(mimeType)) {
      const mb = (fileSizeLimit(mimeType) / 1024 / 1024).toFixed(0)
      skipped.push(`"${file.name}" exceeds the ${mb} MB limit for ${ACCEPTED_MIME_TYPES[mimeType]}s`)
      continue
    }

    let dataUrl: string
    let storedType = mimeType
    if (mimeType.startsWith('image/')) {
      const r = await compressImageIfNeeded(file, mimeType)
      dataUrl   = r.dataUrl
      storedType = r.type
    } else {
      dataUrl = await readAsDataUrl(file)
    }

    addAttachment({ name: file.name, type: storedType, dataUrl })
    track('file_attached', { file_type: storedType })
  }

  if (skipped.length === 1) return `${skipped[0]}.`
  if (skipped.length > 1) return `${skipped.length} files were skipped (over the size limit).`
  return null
}

// Read a FileSystemFileEntry into a real File. For OneDrive/cloud-only files
// this triggers on-demand hydration — which item.getAsFile() does not, so it
// hands back an empty placeholder instead.
function entryToFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (f) => resolve(f),
      () => resolve(null),
    )
  })
}

// readEntries hands back directory children in batches; keep calling until drained.
function readAllDirEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const out: FileSystemEntry[] = []
    const pump = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) resolve(out)
          else { out.push(...batch); pump() }
        },
        () => resolve(out),
      )
    }
    pump()
  })
}

// Walk a dropped entry (file or folder), collecting real Files. Recurses into
// subfolders up to MAX_FOLDER_DEPTH and stops once we hit `maxFiles`.
async function collectFromEntry(entry: FileSystemEntry, files: File[], depth: number, maxFiles: number): Promise<void> {
  if (files.length >= maxFiles) return
  if (entry.isFile) {
    const f = await entryToFile(entry as FileSystemFileEntry)
    if (f && f.size > 0) files.push(f)
  } else if (entry.isDirectory && depth < MAX_FOLDER_DEPTH) {
    const children = await readAllDirEntries((entry as FileSystemDirectoryEntry).createReader())
    for (const child of children) {
      if (files.length >= maxFiles) break
      await collectFromEntry(child, files, depth + 1, maxFiles)
    }
  }
}

// Collect real File objects from a drop event. Walks dropped folders and reads
// files through the entry API, which hydrates OneDrive/cloud-only files on
// demand (getAsFile() would return an empty placeholder for those).
//
// `maxFiles` caps how many files a folder can contribute. `allowFolders` gates
// directory drops (a Pro feature): when false, dropped folders are ignored and
// `blockedFolder` is set so the caller can prompt an upgrade.
export async function extractDroppedFiles(
  e: React.DragEvent,
  opts: { maxFiles?: number; allowFolders?: boolean } = {},
): Promise<{ files: File[]; hadUriOnly: boolean; truncated: boolean; blockedFolder: boolean }> {
  const maxFiles = opts.maxFiles ?? MAX_FOLDER_FILES
  const allowFolders = opts.allowFolders ?? true

  // DataTransfer is only valid synchronously inside the handler, so snapshot
  // entries (and any fallbacks) before the first await.
  const entries: FileSystemEntry[] = []
  const fallbackFiles: File[] = []
  if (e.dataTransfer.items) {
    for (const item of Array.from(e.dataTransfer.items)) {
      if (item.kind !== 'file') continue
      const entry = item.webkitGetAsEntry?.()
      if (entry) entries.push(entry)
      else {
        const f = item.getAsFile()
        if (f) fallbackFiles.push(f)
      }
    }
  }
  const plainFiles = Array.from(e.dataTransfer.files)
  const types = Array.from(e.dataTransfer.types)

  let blockedFolder = false
  const files: File[] = []
  for (const entry of entries) {
    if (entry.isDirectory && !allowFolders) { blockedFolder = true; continue }
    if (files.length >= maxFiles) break
    await collectFromEntry(entry, files, 0, maxFiles)
  }
  const truncated = files.length >= maxFiles

  // Entry API yielded nothing (older browsers, or non-entry drops): fall back.
  if (files.length === 0) {
    for (const f of fallbackFiles) if (f.size > 0) files.push(f)
  }
  if (files.length === 0) {
    for (const f of plainFiles) if (f.size > 0) files.push(f)
  }

  const hadUriOnly = files.length === 0 && !blockedFolder &&
    (types.includes('text/uri-list') || types.includes('Files'))

  return { files, hadUriOnly, truncated, blockedFolder }
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

// ── Imported-conversation upsell banner ───────────────────────────────────────
// Shown once (per browser) when viewing a conversation that was imported from the
// browser extension. The extension captures the tree; these features only exist
// in the full web app. Dismissal is remembered so it never nags.
const IMPORT_UPSELL_DISMISS_KEY = 'nodea_import_upsell_dismissed'

function ImportedUpsellBanner() {
  const { activeConvIsImported } = useApp()
  const [dismissed, setDismissed] = useState(true)

  // Read persisted dismissal on mount (client-only; avoids SSR mismatch).
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(IMPORT_UPSELL_DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!activeConvIsImported || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(IMPORT_UPSELL_DISMISS_KEY, '1') } catch {}
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-base))',
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45,
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }} aria-hidden>✨</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        Your imported chat is now a canvas. Only the full app lets you{' '}
        <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>merge branches</strong>,{' '}
        <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>drop sticky notes</strong>, and{' '}
        <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>color your tree</strong>.
      </span>
      <a
        href="/extension"
        onClick={() => { try { track('import_upsell_clicked') } catch {} }}
        style={{
          flexShrink: 0, height: 28, display: 'inline-flex', alignItems: 'center',
          padding: '0 12px', borderRadius: 7, textDecoration: 'none',
          background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        See what&apos;s new →
      </a>
      <button
        title="Dismiss"
        onClick={dismiss}
        style={{
          flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar() {
  const { convName, setIsSearchOpen, setIsChatCollapsed, activeConvIsImported, updateFromSource, isUpdatingSource } = useApp()

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
        {activeConvIsImported && (
          <button
            title={isUpdatingSource ? 'Checking Claude for new branches…' : 'Pull any new branches in from Claude'}
            onClick={() => { if (!isUpdatingSource) void updateFromSource() }}
            disabled={isUpdatingSource}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', marginRight: 4,
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
              cursor: isUpdatingSource ? 'default' : 'pointer', color: 'var(--text-secondary)',
              fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', opacity: isUpdatingSource ? 0.7 : 1,
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => { if (!isUpdatingSource) { const t = e.currentTarget as HTMLButtonElement; t.style.background = 'var(--bg-subtle)'; t.style.color = 'var(--text-primary)' } }}
            onMouseLeave={(e) => { const t = e.currentTarget as HTMLButtonElement; t.style.background = 'transparent'; t.style.color = 'var(--text-secondary)' }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className={isUpdatingSource ? 'nx-spin' : undefined} style={{ flexShrink: 0 }}>
              <path d="M12.5 7a5.5 5.5 0 1 1-1.6-3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12.6 1.5V4H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isUpdatingSource ? 'Updating…' : 'Update'}
          </button>
        )}
        <IconBtn title="Search (⌘K)" onClick={() => setIsSearchOpen(true)}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </IconBtn>
        <IconBtn title="Collapse chat" onClick={() => setIsChatCollapsed(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 2L0 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
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

export function AttachmentChip({ attachment, onRemove }: { attachment: AttachmentItem; onRemove?: () => void }) {
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

// ── Prompt-version arrow (‹ / ›) ───────────────────────────────────────────────
function VersionArrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={dir === 'prev' ? 'Previous version' : 'Next version'}
      style={{
        width: 18, height: 18, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', borderRadius: 5,
        color: 'var(--text-muted)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <svg width="7" height="10" viewBox="0 0 7 10" fill="none">
        {dir === 'prev'
          ? <path d="M5 1L1.5 5 5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M2 1l3.5 4L2 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </button>
  )
}

// ── Message ───────────────────────────────────────────────────────────────────
function Message({ msg, isLast, isHighlighted }: { msg: ChatMessage; isLast: boolean; isHighlighted: boolean }) {
  const { isLoading, memorySavedByMsgId, editUserMessage, promptVersionInfo, handleNodeClick, activeConvSource } = useApp()
  const savedMemories = !msg.role || msg.role === 'assistant' ? memorySavedByMsgId[msg.id] : undefined
  const isUser = msg.role === 'user'
  const isEmptyStreaming = isLast && isLoading && !isUser && !msg.content
  const [elapsed, setElapsed] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const [hovered, setHovered] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isEmptyStreaming) { setElapsed(0); return }
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(id)
  }, [isEmptyStreaming])

  // Focus + size the inline editor when it opens; drop the caret at the end.
  useEffect(() => {
    if (!editing) return
    const el = editRef.current
    if (!el) return
    el.focus()
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  const images = (msg.attachments ?? []).filter((a) => a.type.startsWith('image/'))
  const files  = (msg.attachments ?? []).filter((a) => !a.type.startsWith('image/'))

  const versions = isUser ? promptVersionInfo(msg.id) : null
  const canEdit  = isUser && !isLoading

  const cancelEdit = () => { setEditing(false); setDraft(msg.content) }
  const saveEdit = () => {
    const t = draft.trim()
    if (!t) return
    setEditing(false)
    void editUserMessage(msg.id, t)
  }

  return (
    <div
      data-highlighted-msg={isHighlighted ? 'true' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingLeft: isUser ? 48 : 0 }}
    >
      {!isUser && (
        <div style={{ width: 40, flexShrink: 0, textAlign: 'right', paddingTop: 9, fontSize: 10, color: 'var(--text-muted)' }}>
          {msg.timestamp ? formatTime(msg.timestamp) : ''}
        </div>
      )}

      {!isUser && (() => {
        // The AI agent's icon. A reply imported from a third-party source (e.g.
        // claude.ai) wears that source's own brand logo on a neutral chip; a
        // reply generated natively in Nodea keeps the normal gradient mark.
        const importedSrc = msg.imported ? getAISource(activeConvSource) : null
        if (importedSrc?.logo) {
          return (
            <div
              title={`From ${importedSrc.name}`}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#fff', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 5,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={importedSrc.logo} width={16} height={16} alt="" aria-hidden style={{ display: 'block' }} />
            </div>
          )
        }
        return (
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
        )
      })()}

      <div style={{ flex: 1, minWidth: 0 }}>
        {!isUser && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
            {(() => {
              // Imported from a third party (e.g. claude.ai)? The avatar already
              // wears that source's brand logo, so the header just names it.
              const importedSrc = msg.imported ? getAISource(activeConvSource) : null
              if (importedSrc) return <span>{importedSrc.name}</span>
              // Native Nodea reply: its model logo + name. Driven by the node's
              // persisted model_id so it survives a refresh; falls back to Claude
              // (every model Nodea generates is a Claude model).
              const logo = getAISource(providerForModel(msg.modelId))?.logo
              return (
                <>
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} width={13} height={13} alt="" aria-hidden style={{ display: 'block', flexShrink: 0 }} />
                  ) : null}
                  <span>Claude{msg.modelId ? ` · ${modelDisplayName(msg.modelId)}` : ''}</span>
                </>
              )
            })()}
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

        {/* Assistant bubble (markdown / streaming placeholder) */}
        {!isUser && (
          <div
            style={{
              maxWidth: '100%',
              padding: '12px 15px',
              borderRadius: '4px 14px 14px 14px',
              background: 'var(--ai-card-bg)',
              border: '1px solid var(--ai-card-border)',
              fontSize: 13, lineHeight: 1.65,
              color: 'var(--text-primary)', wordBreak: 'break-word',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {msg.content
              ? <MarkdownContent content={msg.content} />
              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {isEmptyStreaming && elapsed > 1
                    ? `${elapsed < 5 ? 'Thinking' : elapsed < 12 ? 'Processing' : 'Analyzing'}… ${elapsed}s`
                    : 'Thinking…'}
                </span>}
          </div>
        )}

        {/* User prompt — inline editor (Claude/GPT-style) */}
        {isUser && editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              ref={editRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
              }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--input-bg)', border: '1px solid var(--accent)',
                borderRadius: 12, padding: '10px 13px',
                fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)',
                resize: 'none', outline: 'none', fontFamily: 'inherit',
                maxHeight: 240, overflowY: 'auto',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 'auto' }}>
                Saving forks a new version. The original is kept.
              </span>
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!draft.trim()}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: draft.trim() ? 'var(--accent)' : 'var(--bg-muted)',
                  border: 'none',
                  color: draft.trim() ? '#fff' : 'var(--text-muted)',
                  cursor: draft.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Save &amp; submit
              </button>
            </div>
          </div>
        )}

        {/* User prompt — bubble with hover-revealed edit affordance */}
        {isUser && !editing && msg.content && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 6 }}>
            {canEdit && (
              <button
                type="button"
                title="Edit message"
                onClick={() => { setDraft(msg.content); setEditing(true) }}
                style={{
                  width: 26, height: 26, flexShrink: 0, marginBottom: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none', borderRadius: 7,
                  color: 'var(--text-muted)', cursor: 'pointer',
                  opacity: hovered ? 1 : 0,
                  pointerEvents: hovered ? 'auto' : 'none',
                  transition: 'opacity 0.12s, background 0.12s, color 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M9.4 2.1l2.5 2.5L5 11.5l-3 .5.5-3 6.9-6.9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <div
              style={{
                maxWidth: '76%',
                padding: '9px 14px',
                borderRadius: '14px 14px 4px 14px',
                background: 'var(--user-bubble-bg)',
                border: isHighlighted ? '1px solid var(--accent)' : '1px solid var(--user-bubble-border)',
                fontSize: 13, lineHeight: 1.65,
                color: 'var(--text-primary)', wordBreak: 'break-word',
                boxShadow: isHighlighted ? '0 0 0 3px var(--accent-bg)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
            </div>
          </div>
        )}

        {/* User prompt footer: version arrows (‹ n/m ›) + timestamp */}
        {isUser && !editing && (msg.timestamp || versions) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4 }}>
            {versions && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--text-muted)' }}>
                <VersionArrow
                  dir="prev"
                  disabled={!versions.prevId}
                  onClick={() => { if (versions.prevId) void handleNodeClick(versions.prevId) }}
                />
                <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'center' }}>
                  {versions.index + 1}/{versions.total}
                </span>
                <VersionArrow
                  dir="next"
                  disabled={!versions.nextId}
                  onClick={() => { if (versions.nextId) void handleNodeClick(versions.nextId) }}
                />
              </span>
            )}
            {msg.timestamp && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(msg.timestamp)}</span>
            )}
          </div>
        )}

        {!isUser && savedMemories && savedMemories.length > 0 && (
          <div
            title={savedMemories.join('\n')}
            style={{
              marginTop: 6,
              fontSize: 11,
              fontStyle: 'italic',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'help',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 1.5h6a1.5 1.5 0 0 1 1.5 1.5v8L6 8.5 1.5 11V3A1.5 1.5 0 0 1 3 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
            <span>saved to memory</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Input bar ─────────────────────────────────────────────────────────────────
function InputBar({ onFileError, variant = 'docked' }: { onFileError: (msg: string) => void; variant?: 'docked' | 'centered' }) {
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

  // Resize textarea when input changes externally (e.g. draft restore from localStorage)
  useEffect(() => {
    const el = chatInputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input, chatInputRef])

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

  const isCentered = variant === 'centered'

  return (
    <div
      style={
        isCentered
          ? { padding: 0, background: 'transparent' }
          : { padding: '12px 20px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-base)', flexShrink: 0 }
      }
    >
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
  const { messages, isLoading, activeConvId, createConversation, chatError, clearChatError, saveError, clearSaveError, highlightedMessageId, addAttachment, userName, isChatCollapsed, setIsChatCollapsed, isPro, isAdmin, setIsUpgradeOpen } = useApp()
  const bottomRef    = useRef<HTMLDivElement>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)
  // Whether to keep pinning the view to the latest output. Set false the moment
  // the user scrolls away from the bottom so streaming can't yank them back down.
  const stickToBottom = useRef(true)
  const dragCounter  = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError,  setFileError]  = useState<string | null>(null)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottom.current = distanceFromBottom < 80
  }, [])

  // Re-pin to bottom whenever the user switches conversations.
  useEffect(() => {
    stickToBottom.current = true
  }, [activeConvId])

  useEffect(() => {
    if (highlightedMessageId) {
      const el = document.querySelector('[data-highlighted-msg="true"]')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    // Only follow new output if the user is parked at the bottom. If they've
    // scrolled up to read, leave their position alone.
    if (!stickToBottom.current) return
    // During streaming this fires every rAF tick; 'smooth' would queue
    // animations and visibly lag. Use instant scroll while streaming.
    bottomRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' })
  }, [messages, highlightedMessageId, isLoading])

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

    const cap = isAdmin ? MAX_ADMIN_FOLDER_FILES : MAX_FOLDER_FILES
    const { files, hadUriOnly, truncated, blockedFolder } = await extractDroppedFiles(e, {
      maxFiles: cap,
      allowFolders: isPro,
    })

    if (files.length === 0) {
      if (blockedFolder) {
        setFileError('Dropping a whole folder is a Pro feature. Upgrade to attach folders, or drop individual files.')
        setIsUpgradeOpen(true)
      } else if (hadUriOnly) {
        setFileError(
          'That file could not be read. If it’s a cloud-only OneDrive file, open it once (or right-click → "Always keep on this device") so Windows downloads a local copy, then drop it again.'
        )
      }
      return
    }

    const err = await processFiles(files, addAttachment)
    if (err) setFileError(err)
    else if (blockedFolder) {
      setFileError('Folders are a Pro feature — attached the loose files only. Upgrade to include whole folders.')
    } else if (truncated) {
      setFileError(`Only the first ${cap} files from that folder were added.`)
    }
  }, [addAttachment, isPro, isAdmin, setIsUpgradeOpen])

  const showThinkingBubble = isLoading && messages[messages.length - 1]?.role !== 'assistant'

  if (isChatCollapsed) {
    return (
      <div style={{ width: 44, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border)', background: 'var(--topbar-bg)' }}>
        <button
          onClick={() => setIsChatCollapsed(false)}
          title="Expand chat"
          style={{
            marginTop: 12, width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-subtle)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
          </svg>
        </button>
        <div style={{ marginTop: 16, opacity: 0.3, color: 'var(--text-primary)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M15 12a2 2 0 0 1-2 2H5l-3 2.5V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    )
  }

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
      <ImportedUpsellBanner />

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
        ref={scrollRef}
        onScroll={handleScroll}
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
          /* ── Empty state: conversation exists but no messages — centered input ── */
          <div
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 26, padding: '20px 24px 28vh', minHeight: 0,
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: 560 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
                {userName ? `What's on your mind, ${userName}?` : "What's on your mind?"}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Send a message to start. Every reply becomes a node you can branch from.
              </div>
            </div>
            <div style={{ width: '100%', maxWidth: 720 }}>
              <InputBar onFileError={setFileError} variant="centered" />
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

      {!(activeConvId && messages.length === 0) && <InputBar onFileError={setFileError} />}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
