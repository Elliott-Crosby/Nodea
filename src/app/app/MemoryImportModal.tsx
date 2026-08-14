'use client'

import { useMemo, useState } from 'react'

// Paste-your-memory import from Claude / ChatGPT. Shared by the Settings
// memory tab and the first-load prompt (MemoryImportPrompt). Parsing happens
// client-side so the user sees exactly how many memories they're about to
// save; the API re-validates.

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

  const parsed = useMemo(() => parseMemoryLines(raw), [raw])

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

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }
  const muted: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }

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
          width: 'min(520px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--ai-card-bg, var(--bg, #fff))',
          border: '1px solid var(--border, #e5e5e5)', borderRadius: 14,
          padding: '26px 24px', color: 'var(--text-primary, #111)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        {savedCount !== null ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{savedCount} memor{savedCount === 1 ? 'y' : 'ies'} imported</h2>
            {/* Hard UI rule: anything written to memory shows the italic indicator. */}
            <p style={{ ...muted, fontStyle: 'italic', marginTop: 6 }}>saved to memory</p>
            <p style={{ ...muted, marginTop: 10 }}>
              Claude now starts every Nodea conversation knowing this about you.
              Review or edit anytime in Settings → Memory.
            </p>
            <button
              type="button"
              onClick={() => onDone(savedCount)}
              style={{
                marginTop: 16, padding: '10px 26px', borderRadius: 9, border: 'none',
                background: 'var(--accent, #7c3aed)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Bring your memory with you</h2>
            <p style={{ ...muted, margin: '8px 0 14px' }}>
              Claude and ChatGPT have learned things about you. Paste those
              memories here and Nodea starts every conversation already knowing
              them — one memory per line.
            </p>

            <div style={{
              border: '1px solid var(--border, #e5e5e5)', borderRadius: 10,
              padding: '10px 12px', marginBottom: 14, background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
            }}>
              <div style={label}>Where to find it</div>
              <div style={{ ...muted, marginTop: 4 }}>
                <strong>Claude:</strong> claude.ai → Settings → Memory → copy what Claude remembers.<br />
                <strong>ChatGPT:</strong> Settings → Personalization → Manage memories → copy the entries.
              </div>
            </div>

            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              rows={7}
              placeholder={'Prefers concise answers without bullet lists\nWorks primarily in TypeScript and Next.js\nIs studying computer engineering'}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                borderRadius: 10, border: '1px solid var(--border, #e5e5e5)',
                background: 'var(--input-bg, transparent)', color: 'var(--text-primary, #111)',
                fontSize: 13, lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <div style={{ ...muted, fontSize: 11, marginTop: 6 }}>
              {parsed.length > 0 ? `${parsed.length} memor${parsed.length === 1 ? 'y' : 'ies'} detected` : 'Nothing detected yet — paste one memory per line'}
            </div>

            {error && <div style={{ fontSize: 13, color: '#f87171', marginTop: 10 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
              <button
                type="button"
                onClick={submit}
                disabled={parsed.length === 0 || saving}
                style={{
                  padding: '10px 22px', borderRadius: 9, border: 'none',
                  background: 'var(--accent, #7c3aed)', color: '#fff', fontSize: 14, fontWeight: 600,
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
                    style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border, #e5e5e5)', background: 'transparent', color: 'var(--text-secondary, #444)', fontSize: 13, cursor: 'pointer' }}
                  >
                    Maybe later
                  </button>
                  <button
                    type="button"
                    onClick={markNothingToImport}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted, #888)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    I don&apos;t use memory
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border, #e5e5e5)', background: 'transparent', color: 'var(--text-secondary, #444)', fontSize: 13, cursor: 'pointer' }}
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
