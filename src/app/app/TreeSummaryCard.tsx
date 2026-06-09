'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from './App'

// ─── Tree summary card ───────────────────────────────────────────────────────
// A re-entry hook. When you re-open a conversation (tree), this shows a short
// "where this stands" briefing plus the open loops you never closed — the
// branches/questions left unexplored. Clicking an open loop drops it into the
// chat input so one click puts you back to work. Dismissed per tree-state, so
// it never nags: once dismissed it stays gone until the tree actually changes.
//
// Mounted with `key={activeConvId}` so it remounts fresh per conversation —
// that resets state on tree-switch without synchronous setState in an effect.

const MIN_NODES = 3

interface SummaryData {
  summary:   string
  openLoops: string[]
}

export default function TreeSummaryCard() {
  const { activeConvId, allDbNodes, setInput, chatInputRef } = useApp()

  const [data, setData]     = useState<SummaryData | null>(null)
  const [closed, setClosed] = useState(false)

  const nodeCount = allDbNodes.length
  // Fire once per mount (i.e. once per tree-open). Stops the card re-popping
  // as you chat and nodeCount grows — this is a re-entry hook, not a live feed.
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    if (!activeConvId || nodeCount < MIN_NODES) return  // wait until loaded enough
    fired.current = true

    // Respect a prior dismissal for this tree-state (same or fewer nodes):
    // leave `data` null so the card simply renders nothing.
    try {
      const d = localStorage.getItem(`tree_summary_dismissed_${activeConvId}`)
      if (d && Number(d) >= nodeCount) return
    } catch {}

    const convAtRequest = activeConvId
    fetch(`/api/projects/${activeConvId}/summary`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (convAtRequest !== activeConvId) return  // switched away — stale
        if (j && j.summary) setData({ summary: j.summary, openLoops: j.openLoops ?? [] })
      })
      .catch(() => {})
  }, [activeConvId, nodeCount])

  function close() {
    setClosed(true)
    try {
      if (activeConvId) localStorage.setItem(`tree_summary_dismissed_${activeConvId}`, String(nodeCount))
    } catch {}
  }

  function pickLoop(loop: string) {
    setInput(loop)
    close()
    requestAnimationFrame(() => chatInputRef.current?.focus())
  }

  if (!activeConvId || closed || !data) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(560px, calc(100vw - 48px))',
        background: 'var(--modal-bg)',
        border: '1px solid var(--border-strong)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-lg)',
        padding: '13px 14px 13px 16px',
        zIndex: 9000,
        fontSize: 13.5,
        lineHeight: 1.5,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
        }}>
          Where this stands
        </span>
        <button
          onClick={close}
          aria-label="Dismiss"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      </div>

      <p style={{ margin: 0, color: 'var(--text-primary)' }}>{data.summary}</p>

      {data.openLoops.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 6,
          }}>
            Pick back up
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {data.openLoops.map((loop, i) => (
              <button
                key={i}
                onClick={() => pickLoop(loop)}
                title="Drop this into the chat to continue"
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 9,
                  padding: '7px 10px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  lineHeight: 1.4,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>↳</span>
                <span>{loop}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
