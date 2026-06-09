'use client'

import React, { useState, type CSSProperties, type ReactNode } from 'react'
import { ICON_PATHS } from '../projectConstants'

// ── Lucide-style icons (stroke 2, round) — ported from the design bundle ──────
interface IcoProps { s?: number; w?: number; style?: CSSProperties; children?: ReactNode }
const Ico = ({ s = 20, w = 2, style, children }: IcoProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={style}>{children}</svg>
)
type P = Omit<IcoProps, 'children'>
export const IcMenu = (p: P) => <Ico {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Ico>
export const IcPlus = (p: P) => <Ico {...p}><path d="M12 5v14M5 12h14" /></Ico>
export const IcSearch = (p: P) => <Ico {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Ico>
export const IcSettings = (p: P) => <Ico {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 9.4a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6h.09A1.65 1.65 0 0 0 12 4.5a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 17 6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 11h.1a2 2 0 0 1 0 4z" /></Ico>
export const IcSun = (p: P) => <Ico {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Ico>
export const IcMoon = (p: P) => <Ico {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></Ico>
export const IcBranch = (p: P) => <Ico {...p}><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></Ico>
export const IcZoomIn = (p: P) => <Ico {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></Ico>
export const IcZoomOut = (p: P) => <Ico {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8 11h6" /></Ico>
export const IcFit = (p: P) => <Ico {...p}><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" /></Ico>
export const IcX = (p: P) => <Ico {...p}><path d="M18 6 6 18M6 6l12 12" /></Ico>
export const IcChat = (p: P) => <Ico {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.3-4A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" /></Ico>
export const IcTree = (p: P) => <Ico {...p}><rect x="9" y="3" width="6" height="5" rx="1.4" /><rect x="2.5" y="16" width="6" height="5" rx="1.4" /><rect x="15.5" y="16" width="6" height="5" rx="1.4" /><path d="M12 8v3M12 11H5.5v5M12 11h6.5v5" /></Ico>
export const IcChevR = (p: P) => <Ico {...p}><path d="m9 6 6 6-6 6" /></Ico>
export const IcCopy = (p: P) => <Ico {...p}><rect x="9" y="9" width="11" height="11" rx="2.2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Ico>
export const IcCheck = (p: P) => <Ico {...p}><path d="M20 6 9 17l-5-5" /></Ico>

// ── Project icon (curated line glyphs from projectConstants) ─────────────────
export function ProjectIcon({ name, size = 18, color = 'currentColor', sw = 1.7, style }: {
  name: string; size?: number; color?: string; sw?: number; style?: CSSProperties
}) {
  const inner = ICON_PATHS[name] || ICON_PATHS.hexagon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}
      dangerouslySetInnerHTML={{ __html: inner }} />
  )
}

// ── Pin glyph ─────────────────────────────────────────────────────────────────
export const PinGlyph = ({ s = 13, color }: { s?: number; color?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={color || 'currentColor'}><path d="M9 4h6l-1 6 3 3v2h-5v5l-1 1-1-1v-5H4v-2l3-3z" /></svg>
)

// ── clipboard helper (with execCommand fallback for sandboxed frames) ────────
export function copyText(t: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
  } catch { /* give up silently */ }
}

const cleanCopy = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')

export function CopyBtn({ text, markdown, label }: { text: string; markdown?: boolean; label?: boolean }) {
  const [done, setDone] = useState(false)
  const onClick = () => { copyText(markdown ? cleanCopy(text) : text); setDone(true); setTimeout(() => setDone(false), 1400) }
  return (
    <button className={`nm-msgbtn ${done ? 'done' : ''} ${label ? '' : 'icononly'}`} onClick={onClick} aria-label="Copy text">
      {done ? <IcCheck s={13} /> : <IcCopy s={13} />}{label ? (done ? 'Copied' : 'Copy') : ''}
    </button>
  )
}

// ── minimal markdown: **bold** *italic*, "- " bullets, paragraphs ────────────
function renderInline(text: string, kb: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[2] != null) out.push(<strong key={kb + 'b' + i}>{m[2]}</strong>)
    else if (m[3] != null) out.push(<em key={kb + 'i' + i}>{m[3]}</em>)
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  let k = 0
  const flush = () => {
    if (!bullets.length) return
    const items = bullets
    blocks.push(<ul key={'ul' + k++}>{items.map((b, i) => <li key={i}>{renderInline(b, 'li' + k + i)}</li>)}</ul>)
    bullets = []
  }
  for (const line of lines) {
    const t = line.trim()
    if (/^[-*]\s+/.test(t)) bullets.push(t.replace(/^[-*]\s+/, ''))
    else if (!t.length) flush()
    else { flush(); blocks.push(<p key={'p' + k++}>{renderInline(t, 'p' + k)}</p>) }
  }
  flush()
  return <>{blocks}</>
}
