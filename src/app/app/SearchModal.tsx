'use client'

import { useState, useRef, useEffect } from 'react'
import { useApp } from './App'

type Mode = 'keyword' | 'concept'

interface SearchResult {
  id: string
  role: 'user' | 'assistant'
  content: string
  excerpt: string
  reason?: string
}

export default function SearchModal() {
  const { setIsSearchOpen, allDbNodes, activeConvId, handleNodeClick } = useApp()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('keyword')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Keyword search (client-side) ──────────────────────────────────────────
  function doKeywordSearch(q: string) {
    const lower = q.toLowerCase().trim()
    if (!lower) { setResults([]); setHasSearched(false); return }
    const matches = allDbNodes
      .filter((n) => n.content.toLowerCase().includes(lower))
      .map((n) => {
        const idx = n.content.toLowerCase().indexOf(lower)
        const start = Math.max(0, idx - 40)
        const excerpt = (start > 0 ? '…' : '') + n.content.slice(start, idx + lower.length + 60).trim() + '…'
        return { id: n.id, role: n.role, content: n.content, excerpt }
      })
    setResults(matches)
    setHasSearched(true)
  }

  // ── Concept / semantic search (via Claude) ────────────────────────────────
  async function doConceptSearch(q: string) {
    if (!q.trim() || !activeConvId) { setResults([]); setHasSearched(false); return }
    setIsSearching(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, projectId: activeConvId }),
      })
      if (!res.ok) throw new Error('Search failed')
      const { results: r } = await res.json()
      setResults(r)
    } catch (e) {
      console.error('Concept search error', e)
      setResults([])
    } finally {
      setIsSearching(false)
      setHasSearched(true)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'keyword') doKeywordSearch(query)
    else doConceptSearch(query)
  }

  // Live keyword search as user types
  useEffect(() => {
    if (mode === 'keyword') doKeywordSearch(query)
  }, [query, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleResultClick(id: string) {
    handleNodeClick(id)
    setIsSearchOpen(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-overlay)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 1000,
      }}
      onClick={() => setIsSearchOpen(false)}
    >
      <div
        style={{
          width: 560,
          maxWidth: 'calc(100vw - 40px)',
          background: 'var(--modal-bg)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search form */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 16px',
              gap: 10,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'keyword' ? 'Search messages…' : 'Describe a concept or idea…'}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: 'var(--text-primary)',
              }}
            />
            {isSearching && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Searching…</span>
            )}
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 2,
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </form>

        {/* Mode toggle */}
        <div
          style={{
            display: 'flex',
            padding: '8px 16px',
            gap: 4,
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
          }}
        >
          {(['keyword', 'concept'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setResults([])
                setHasSearched(false)
              }}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-secondary)',
                transition: 'background 0.12s',
              }}
            >
              {m === 'keyword' ? '🔤 Keyword' : '💡 Concept'}
            </button>
          ))}
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
            {mode === 'keyword'
              ? 'Exact text match'
              : 'AI finds related ideas — even if the wording differs'}
          </span>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {!hasSearched && !isSearching && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {mode === 'keyword' ? 'Start typing to search' : 'Enter a concept and press Enter to search'}
            </div>
          )}

          {hasSearched && results.length === 0 && !isSearching && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No results found for "{query}"
            </div>
          )}

          {results.map((r, i) => (
            <button
              key={r.id + i}
              onClick={() => handleResultClick(r.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: r.role === 'user' ? '#3b82f6' : 'var(--accent-text)',
                  }}
                >
                  {r.role === 'user' ? 'You' : 'Claude'}
                </span>
                {r.reason && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {r.reason}</span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {r.excerpt}
              </p>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            display: 'flex',
            gap: 12,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span>↵ Jump to message</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
