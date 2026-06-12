// Canvas-2D export renderer for Presentation Mode. Draws the exact scene the
// overlay shows (same palette + layout maths from presentationModel) onto an
// offscreen canvas, then packages it as a PNG blob or a single-page PDF.
// Deliberately dependency-free: no html-to-image/jspdf, no CSS-var or
// foreignObject flakiness — what you see is what exports.

import {
  bgOption, type BgId, type PresPalette, CALLOUT_W,
} from './presentationModel'

export interface ExportNode {
  x: number; y: number; w: number; h: number
  color:    string   // '' = default
  title:    string
  summary:  string
  prompt:   string
  answer:   string
  expanded: boolean
  hidden:   boolean  // greyed out (drawn at reduced alpha)
}

export interface ExportEdge { x1: number; y1: number; x2: number; y2: number; faded: boolean }

export interface ExportCallout {
  x: number; y: number
  text:    string
  // node-centre anchor points the dashed connectors run to
  anchors: { x: number; y: number }[]
}

export interface ExportScene {
  nodes:    ExportNode[]
  edges:    ExportEdge[]
  callouts: ExportCallout[]
  bg:       BgId
  title:    string   // '' = no title block
  // Bottom-left "Nodea" watermark (app icon + wordmark). wordmarkFont is the
  // resolved Bricolage Grotesque family (next/font internal name) so the
  // canvas matches the site wordmark; falls back to the public name.
  watermark:     boolean
  wordmarkFont?: string
}

const MARGIN      = 72
const TITLE_GAP   = 56
const MAX_DIM     = 8192   // canvas safety cap (browser limits)
const FONT_STACK  = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

// ── Text wrapping ─────────────────────────────────────────────────────────────
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const out: string[] = []
  // Preserve explicit paragraph breaks but treat each as a wrap point.
  const paragraphs = text.split(/\n+/)
  for (const para of paragraphs) {
    if (out.length >= maxLines) break
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const tryLine = line ? line + ' ' + word : word
      if (ctx.measureText(tryLine).width <= maxWidth || !line) {
        line = tryLine
      } else {
        out.push(line)
        line = word
        if (out.length >= maxLines) break
      }
    }
    if (out.length < maxLines && line) out.push(line)
  }
  if (out.length >= maxLines) {
    const trimmed = out.slice(0, maxLines)
    let last = trimmed[maxLines - 1]
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    trimmed[maxLines - 1] = last + '…'
    return trimmed
  }
  return out
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}

// Measure a callout's rendered height (mirrors the DOM card: 12px text,
// 1.5 line height, 12px padding top/bottom + 10px grip strip).
export function calloutHeight(text: string): number {
  const canvas = document.createElement('canvas')
  const ctx    = canvas.getContext('2d')!
  ctx.font     = `400 12px ${FONT_STACK}`
  const lines  = wrapText(ctx, text || ' ', CALLOUT_W - 28, 12)
  return Math.max(64, 22 + lines.length * 18 + 14)
}

// ── Scene bounds ──────────────────────────────────────────────────────────────
function sceneBounds(scene: ExportScene) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const n of scene.nodes) {
    x0 = Math.min(x0, n.x);       y0 = Math.min(y0, n.y)
    x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h)
  }
  for (const c of scene.callouts) {
    const h = calloutHeight(c.text)
    x0 = Math.min(x0, c.x);             y0 = Math.min(y0, c.y)
    x1 = Math.max(x1, c.x + CALLOUT_W); y1 = Math.max(y1, c.y + h)
  }
  if (!Number.isFinite(x0)) { x0 = 0; y0 = 0; x1 = 400; y1 = 300 }
  return { x0, y0, x1, y1 }
}

// ── Drawing ───────────────────────────────────────────────────────────────────
// Matches the on-screen `opacity` for hidden nodes / their edges.
export const HIDDEN_ALPHA      = 0.35
export const HIDDEN_EDGE_ALPHA = 0.25

function drawNode(ctx: CanvasRenderingContext2D, n: ExportNode, pal: PresPalette) {
  if (n.hidden) {
    ctx.save()
    ctx.globalAlpha = HIDDEN_ALPHA
    try { drawNodeInner(ctx, n, pal) } finally { ctx.restore() }
    return
  }
  drawNodeInner(ctx, n, pal)
}

function drawNodeInner(ctx: CanvasRenderingContext2D, n: ExportNode, pal: PresPalette) {
  const r = 10
  // tinted fill when coloured, like the in-app tree
  ctx.save()
  roundRect(ctx, n.x, n.y, n.w, n.h, r)
  ctx.fillStyle = pal.nodeBg
  ctx.shadowColor   = pal.dark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.10)'
  ctx.shadowBlur    = 10
  ctx.shadowOffsetY = 2
  ctx.fill()
  ctx.restore()
  if (n.color) {
    roundRect(ctx, n.x, n.y, n.w, n.h, r)
    ctx.fillStyle = n.color + (pal.dark ? '2e' : '1a')
    ctx.fill()
  }
  roundRect(ctx, n.x, n.y, n.w, n.h, r)
  ctx.lineWidth   = 1.5
  ctx.strokeStyle = n.color || pal.nodeBorder
  ctx.stroke()

  const padX = 14
  const maxW = n.w - padX * 2
  ctx.textBaseline = 'top'

  if (!n.expanded) {
    ctx.font      = `600 13px ${FONT_STACK}`
    ctx.fillStyle = pal.textPrimary
    const titleLines = wrapText(ctx, n.title, maxW, 2)
    let y = n.y + 14
    for (const line of titleLines) { ctx.fillText(line, n.x + padX, y); y += 17 }
    if (n.summary) {
      ctx.font      = `400 11px ${FONT_STACK}`
      ctx.fillStyle = pal.textSecondary
      const sumLines = wrapText(ctx, n.summary, maxW, titleLines.length > 1 ? 2 : 3)
      y += 3
      for (const line of sumLines) { ctx.fillText(line, n.x + padX, y); y += 15 }
    }
    return
  }

  // Expanded: full prompt (bold) / divider / full answer, clipped to the card.
  ctx.save()
  roundRect(ctx, n.x, n.y, n.w, n.h, r)
  ctx.clip()

  let y = n.y + 14
  ctx.font      = `600 12px ${FONT_STACK}`
  ctx.fillStyle = pal.textPrimary
  const promptLines = wrapText(ctx, n.prompt || '(empty)', maxW, 7)
  for (const line of promptLines) { ctx.fillText(line, n.x + padX, y); y += 16.5 }

  if (n.answer) {
    y += 8
    ctx.strokeStyle = pal.divider
    ctx.lineWidth   = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(n.x + padX, y)
    ctx.lineTo(n.x + n.w - padX, y)
    ctx.stroke()
    ctx.setLineDash([])
    y += 9

    ctx.font      = `400 11.5px ${FONT_STACK}`
    ctx.fillStyle = pal.textSecondary
    const remaining   = Math.max(0, Math.floor((n.y + n.h - 12 - y) / 16))
    const answerLines = wrapText(ctx, n.answer, maxW, remaining)
    for (const line of answerLines) { ctx.fillText(line, n.x + padX, y); y += 16 }
  }
  ctx.restore()
}

function drawCallout(ctx: CanvasRenderingContext2D, c: ExportCallout, pal: PresPalette) {
  const h = calloutHeight(c.text)
  const cx = c.x + CALLOUT_W / 2
  const cy = c.y + h / 2

  // connectors first, under the card
  ctx.save()
  ctx.strokeStyle = pal.accent
  ctx.globalAlpha = 0.65
  ctx.lineWidth   = 1.5
  ctx.setLineDash([5, 4])
  for (const a of c.anchors) {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    const mx = (cx + a.x) / 2
    ctx.bezierCurveTo(mx, cy, mx, a.y, a.x, a.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(a.x, a.y, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = pal.accent
    ctx.fill()
    ctx.setLineDash([5, 4])
  }
  ctx.restore()

  ctx.save()
  roundRect(ctx, c.x, c.y, CALLOUT_W, h, 9)
  ctx.fillStyle     = pal.calloutBg
  ctx.shadowColor   = pal.dark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.12)'
  ctx.shadowBlur    = 12
  ctx.shadowOffsetY = 3
  ctx.fill()
  ctx.restore()
  roundRect(ctx, c.x, c.y, CALLOUT_W, h, 9)
  ctx.lineWidth   = 1
  ctx.strokeStyle = pal.calloutBorder
  ctx.stroke()
  // accent bar on the left edge
  ctx.fillStyle = pal.accent
  ctx.beginPath()
  ctx.roundRect(c.x, c.y + 8, 3.5, h - 16, 2)
  ctx.fill()

  ctx.font         = `400 12px ${FONT_STACK}`
  ctx.fillStyle    = pal.textPrimary
  ctx.textBaseline = 'top'
  const lines = wrapText(ctx, c.text || ' ', CALLOUT_W - 28, 12)
  let y = c.y + 16
  for (const line of lines) { ctx.fillText(line, c.x + 16, y); y += 18 }
}

// ── Watermark ─────────────────────────────────────────────────────────────────
// Loads the shipped app icon (public /icon.svg) for the export watermark.
// Returns null on any failure — the watermark then renders as wordmark-only.
export async function loadWatermarkIcon(): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch('/icon.svg')
    if (!res.ok) return null
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const img  = new Image()
    img.src = url
    await img.decode()
    URL.revokeObjectURL(url)
    return img
  } catch { return null }
}

const WM_ICON  = 40   // icon edge, logical px
const WM_TEXT  = 34   // wordmark font size
const WM_INSET = { x: 26, y: 18 }

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  logicalW: number,
  logicalH: number,
  pal: PresPalette,
  icon: HTMLImageElement | null,
  fontFamily?: string,
) {
  const x = WM_INSET.x
  const y = logicalH - WM_INSET.y - WM_ICON
  let textX = x
  if (icon) {
    ctx.drawImage(icon, x, y, WM_ICON, WM_ICON)
    textX = x + WM_ICON + 12
  }
  // Wordmark standard: Bricolage Grotesque 500, -0.025em, accent violet.
  const family = fontFamily && fontFamily.trim()
    ? fontFamily
    : `'Bricolage Grotesque', ${FONT_STACK}`
  ctx.save()
  ctx.font         = `500 ${WM_TEXT}px ${family}`
  try { ctx.letterSpacing = '-0.025em' } catch {}
  ctx.fillStyle    = pal.dark ? '#8b5cf6' : '#7c3aed'
  ctx.textBaseline = 'middle'
  ctx.fillText('Nodea', textX, y + WM_ICON / 2 + 1)
  ctx.restore()
}

export function renderSceneToCanvas(
  scene: ExportScene,
  pixelScale = 2,
  assets?: { icon?: HTMLImageElement | null },
): HTMLCanvasElement {
  const bg  = bgOption(scene.bg)
  const pal = bg.palette
  const { x0, y0, x1, y1 } = sceneBounds(scene)

  const titleH   = scene.title ? TITLE_GAP : 0
  const logicalW = (x1 - x0) + MARGIN * 2
  const logicalH = (y1 - y0) + MARGIN * 2 + titleH
  const scale    = Math.min(pixelScale, MAX_DIM / Math.max(logicalW, logicalH))

  const canvas  = document.createElement('canvas')
  canvas.width  = Math.round(logicalW * scale)
  canvas.height = Math.round(logicalH * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // background
  if (scene.bg === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, logicalW, logicalH)
    const stops = bg.gradientStops
    stops.forEach((c, i) => g.addColorStop(i / Math.max(1, stops.length - 1), c))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, logicalW, logicalH)
  } else if (pal.canvas) {
    ctx.fillStyle = pal.canvas
    ctx.fillRect(0, 0, logicalW, logicalH)
  }
  if (pal.dot) {
    ctx.fillStyle = pal.dot
    for (let dy = 12; dy < logicalH; dy += 24) {
      for (let dx = 12; dx < logicalW; dx += 24) {
        ctx.beginPath()
        ctx.arc(dx, dy, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // title block
  if (scene.title) {
    ctx.font         = `600 22px ${FONT_STACK}`
    ctx.fillStyle    = pal.textPrimary
    ctx.textBaseline = 'top'
    ctx.fillText(scene.title, MARGIN, MARGIN - 24)
  }

  // shift scene coordinates into the page (restored before the watermark,
  // which draws in page coordinates)
  ctx.save()
  ctx.translate(MARGIN - x0, MARGIN + titleH - y0)

  ctx.strokeStyle = pal.edge
  ctx.lineWidth   = 1.5
  for (const e of scene.edges) {
    ctx.globalAlpha = e.faded ? HIDDEN_EDGE_ALPHA : 1
    ctx.beginPath()
    ctx.moveTo(e.x1, e.y1)
    if (Math.abs(e.x1 - e.x2) < 2) {
      ctx.lineTo(e.x2, e.y2)
    } else {
      const my = (e.y1 + e.y2) / 2
      ctx.bezierCurveTo(e.x1, my, e.x2, my, e.x2, e.y2)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  for (const n of scene.nodes)    drawNode(ctx, n, pal)
  for (const c of scene.callouts) drawCallout(ctx, c, pal)
  ctx.restore()

  if (scene.watermark) drawWatermark(ctx, logicalW, logicalH, pal, assets?.icon ?? null, scene.wordmarkFont)

  return canvas
}

// ── PNG ───────────────────────────────────────────────────────────────────────
export async function exportPng(scene: ExportScene): Promise<Blob> {
  const icon   = scene.watermark ? await loadWatermarkIcon() : null
  const canvas = renderSceneToCanvas(scene, 2, { icon })
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
  })
}

// ── PDF (hand-rolled single page embedding a JPEG via DCTDecode) ─────────────
function pdfEscapeBytes(parts: (string | Uint8Array)[]): Uint8Array {
  const enc    = new TextEncoder()
  const chunks = parts.map(p => (typeof p === 'string' ? enc.encode(p) : p))
  const total  = chunks.reduce((n, c) => n + c.length, 0)
  const out    = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.length }
  return out
}

export async function exportPdf(scene: ExportScene): Promise<Blob> {
  // Transparent has no meaning in a flattened PDF — render on white instead.
  const pdfScene = scene.bg === 'transparent' ? { ...scene, bg: 'white' as BgId } : scene
  const icon   = scene.watermark ? await loadWatermarkIcon() : null
  const canvas = renderSceneToCanvas(pdfScene, 2, { icon })
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const jpegBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), ch => ch.charCodeAt(0))

  const imgW = canvas.width
  const imgH = canvas.height
  // Page sized to the image at 96dpi-equivalent of the logical size (image is
  // @2x), so the PDF page matches the on-screen dimensions in points.
  const pageW = (imgW / 2) * 0.75
  const pageH = (imgH / 2) * 0.75

  const enc = new TextEncoder()
  const objects: Uint8Array[] = []
  objects.push(enc.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'))
  objects.push(enc.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'))
  objects.push(enc.encode(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] ` +
    `/Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  ))
  objects.push(pdfEscapeBytes([
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    jpegBytes,
    '\nendstream\nendobj\n',
  ]))
  const content = `q ${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm /Im1 Do Q`
  objects.push(enc.encode(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`))

  const header = enc.encode('%PDF-1.4\n%\xB5\xB5\xB5\xB5\n')
  const offsets: number[] = []
  let pos = header.length
  for (const obj of objects) { offsets.push(pos); pos += obj.length }

  const xrefPos = pos
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`

  const bytes = pdfEscapeBytes([header, ...objects, xref, trailer])
  // Copy into a fresh ArrayBuffer-backed view to satisfy BlobPart's typing.
  const buf = new ArrayBuffer(bytes.length)
  new Uint8Array(buf).set(bytes)
  return new Blob([buf], { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
