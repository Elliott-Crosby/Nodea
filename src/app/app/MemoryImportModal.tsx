'use client'

import { useMemo, useRef, useState, useEffect } from 'react'

// Paste-your-memory import from Claude / ChatGPT. Shared by the Settings
// memory tab and the first-load prompt (MemoryImportPrompt). Parsing happens
// client-side so the user sees exactly how many memories they're about to
// save; the API re-validates.
//
// Flow: copy a prompt → paste it into whatever assistant you use → it dumps
// its memories as plain lines → paste those back here. Beats sending people
// hunting through two different settings menus.

const EXTRACT_PROMPT =
  'List everything you remember about me — every saved memory and personalization detail. One fact per line, plain text, no bullets, numbering, headings, or commentary. I am copying this somewhere else.'

export function parseMemoryLines(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    // Strip list markers and numbering ChatGPT/Claude use when listing memories.
    const cleaned = line.replace(/^\s*(?:[-–—•*·]|\d+[.)])\s*/, '').trim()
    if (cleaned.length < 3) continue
    const clamped = cleaned.slice(0, 300)
    const key = clamped.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clamped)
  }
  return out
}

export default function MemoryImportModal({
  onClose,
  onDone,
  skippable,
  onSkip,
  onNothingToImport,
}: {
  onClose: () => void
  onDone: (count: number) => void
  /** Prompt mode: shows "Maybe later" + "I don't use memory" actions. */
  skippable?: boolean
  onSkip?: () => void
  onNothingToImport?: () => void
}) {
  const [raw, setRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const promptRef = useRef<HTMLParagraphElement>(null)

  const parsed = useMemo(() => parseMemoryLines(raw), [raw])

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  async function copyPrompt() {
    let ok = false
    try {
      await navigator.clipboard.writeText(EXTRACT_PROMPT)
      ok = true
    } catch { /* permission denied / insecure context — try the legacy path */ }

    if (!ok) {
      try {
        const ta = document.createElement('textarea')
        ta.value = EXTRACT_PROMPT
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch { /* fall through to manual */ }
    }

    if (!ok && promptRef.current) {
      // Last resort: select the prompt on screen so Ctrl+C works.
      const range = document.createRange()
      range.selectNodeContents(promptRef.current)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }

    setCopyState(ok ? 'copied' : 'manual')
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2500)
  }

  async function submit() {
    if (parsed.length === 0 || saving) return
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/memory-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: parsed }),
      })
      const data = await r.json().catch(() => ({})) as { imported?: number; error?: string }
      if (!r.ok) throw new Error(data.error === 'limit_reached'
        ? 'Memory is full — delete some memories in Settings first.'
        : 'Import failed — please try again.')
      setSavedCount(data.imported ?? parsed.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  async function markNothingToImport() {
    // Stamp "done" without saving anything so the prompt stops re-asking.
    try {
      await fetch('/api/memory-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: [] }),
      })
    } catch { /* non-blocking */ }
    onNothingToImport?.()
  }

  // --text-muted is ~2.9:1 on the light background, so body copy uses
  // --text-secondary and only incidental counters drop to muted.
  const body: React.CSSProperties = { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }
  const stepNum: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
    background: 'var(--accent, #7c3aed)', color: '#fff',
    fontSize: 12, fontWeight: 700, lineHeight: 1,
  }
  const stepTitle: React.CSSProperties = { fontSize: 14, fontWeight: 650, color: 'var(--text-primary)' }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import memory"
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={savedCount === null ? onClose : undefined}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--ai-card-bg, var(--bg, #fff))',
          border: '1px solid var(--border, #e5e5e5)', borderRadius: 14,
          padding: '22px 24px', color: 'var(--text-primary, #111)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        {savedCount !== null ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{savedCount} memor{savedCount === 1 ? 'y' : 'ies'} imported</h2>
            {/* Hard UI rule: anything written to memory shows the italic indicator. */}
            <p style={{ ...body, fontStyle: 'italic', marginTop: 6 }}>saved to memory</p>
            <p style={{ ...body, marginTop: 10 }}>
              Every Nodea conversation now starts knowing this about you.
              Edit anytime in Settings → Memory.
            </p>
            <button
              type="button"
              onClick={() => onDone(savedCount)}
              style={{
                marginTop: 18, padding: '11px 28px', borderRadius: 9, border: 'none',
                background: 'var(--accent, #7c3aed)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Bring your memory with you</h2>
            <p style={{ ...body, margin: '8px 0 16px' }}>
              Nodea can start every conversation already knowing what Claude or
              ChatGPT has learned about you.
            </p>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <span style={stepNum}>1</span>
              <span style={stepTitle}>Ask your assistant for its memories</span>
            </div>
            <div style={{
              // --bg-subtle collapses into the card colour in dark mode, so the
              // prompt block is tinted with the accent instead — reads in both.
              border: '1px solid color-mix(in srgb, var(--accent, #7c3aed) 30%, var(--border, #e5e5e5))',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--accent, #7c3aed) 8%, transparent)',
              padding: '12px 14px', marginBottom: 18,
            }}>
              <p ref={promptRef} style={{ ...body, margin: 0, color: 'var(--text-primary)' }}>{EXTRACT_PROMPT}</p>
              <button
                type="button"
                onClick={copyPrompt}
                style={{
                  marginTop: 12, padding: '8px 16px', borderRadius: 8,
                  border: '1px solid var(--border, #e5e5e5)',
                  background: 'var(--input-bg, #fff)', color: 'var(--text-primary)',
                  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {copyState === 'copied' ? '✓ Copied' : copyState === 'manual' ? 'Selected — press Ctrl+C' : 'Copy prompt'}
              </button>
              <span style={{ ...body, fontSize: 13, marginLeft: 10 }}>
                then paste it into Claude or ChatGPT
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <span style={stepNum}>2</span>
              <span style={stepTitle}>Paste its answer here</span>
            </div>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              rows={6}
              placeholder={'Prefers concise answers without bullet lists\nWorks primarily in TypeScript and Next.js\nIs studying computer engineering'}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '12px 14px',
                borderRadius: 10, border: '1px solid var(--border, #e5e5e5)',
                background: 'var(--input-bg, transparent)', color: 'var(--text-primary, #111)',
                fontSize: 14, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, minHeight: 18 }}>
              {parsed.length > 0 ? `${parsed.length} memor${parsed.length === 1 ? 'y' : 'ies'} detected` : ''}
            </div>

            {error && <div style={{ fontSize: 14, color: '#f87171', marginTop: 10 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
              <button
                type="button"
                onClick={submit}
                disabled={parsed.length === 0 || saving}
                style={{
                  padding: '11px 24px', borderRadius: 9, border: 'none',
                  background: 'var(--accent, #7c3aed)', color: '#fff', fontSize: 15, fontWeight: 600,
                  cursor: parsed.length === 0 || saving ? 'default' : 'pointer',
                  opacity: parsed.length === 0 || saving ? 0.55 : 1,
                }}
              >
                {saving ? 'Importing…' : 'Import'}
              </button>
              {skippable ? (
                <>
                  <button
                    type="button"
                    onClick={onSkip}
                    style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid var(--border, #e5e5e5)', background: 'transparent', color: 'var(--text-secondary, #444)', fontSize: 14, cursor: 'pointer' }}
                  >
                    Maybe later
                  </button>
                  <button
                    type="button"
                    onClick={markNothingToImport}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary, #5c6370)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    I don&apos;t use memory
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid var(--border, #e5e5e5)', background: 'transparent', color: 'var(--text-secondary, #444)', fontSize: 14, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
