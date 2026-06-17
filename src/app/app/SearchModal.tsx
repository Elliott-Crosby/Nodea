'use client'

import { useState, useRef, useEffect } from 'react'
import { track } from '@vercel/analytics'
import { Search, X, Type, Sparkles } from 'lucide-react'
import { useApp } from './App'
import { stripAttachmentMarker } from '@/lib/conversation-export'

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
  const [searchError, setSearchError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Keyword search (client-side) ──────────────────────────────────────────
  function doKeywordSearch(q: string) {
    const lower = q.toLowerCase().trim()
    if (!lower) { setResults([]); setHasSearched(false); return }
    const matches = allDbNodes
      .map((n) => ({ n, text: stripAttachmentMarker(n.content) }))
      .filter(({ text }) => text.toLowerCase().includes(lower))
      .map(({ n, text }) => {
        const idx = text.toLowerCase().indexOf(lower)
        const start = Math.max(0, idx - 40)
        const excerpt = (start > 0 ? '…' : '') + text.slice(start, idx + lower.length + 60).trim() + '…'
        return { id: n.id, role: n.role, content: text, excerpt }
      })
    setResults(matches)
    setHasSearched(true)
  }

  // ── Concept / semantic search (via Claude) ────────────────────────────────
  async function doConceptSearch(q: string) {
    if (!q.trim() || !activeConvId) { setResults([]); setHasSearched(false); return }
    setIsSearching(true)
    setSearchError(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, projectId: activeConvId }),
      })
      if (!res.ok) throw new Error('Search failed')
      const { results: r } = await res.json()
      setResults(r)
      track('search_performed', { mode: 'concept', result_count: (r as unknown[]).length })
    } catch (e) {
      console.error('Concept search error', e)
      setResults([])
      setSearchError('Concept search failed. Check your connection and try again.')
    } finally {
      setIsSearching(false)
      setHasSearched(true)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'keyword') {
      doKeywordSearch(query)
      track('search_performed', { mode: 'keyword', result_count: results.length })
    } else {
      doConceptSearch(query)
    }
  }

  // Live keyword search as user types
  useEffect(() => {
    if (mode === 'keyword') doKeywordSearch(query)
  }, [query, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleResultClick(id: string, rank: number) {
    track('search_result_clicked', { rank, mode })
    handleNodeClick(id)
    setIsSearchOpen(false)
  }

  const placeholder = mode === 'keyword' ? 'Search messages…' : 'Describe a concept or idea…'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-overlay)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
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
          border: '1px solid var(--border-strong)',
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
              gap: 11,
            }}
          >
            <Search size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={mode === 'keyword' ? 'Search messages' : 'Describe a concept or idea'}
              placeholder={placeholder}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 15,
                color: 'var(--text-primary)',
              }}
            />
            {isSearching && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Searching…</span>
            )}
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setIsSearchOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 2,
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </form>

        {/* Mode toggle — segmented control */}
        <div
          style={{
            display: 'flex',
            padding: '0 16px 12px',
            gap: 6,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {([
            { id: 'keyword' as Mode, label: 'Keyword', icon: Type },
            { id: 'concept' as Mode, label: 'Concept', icon: Sparkles },
          ]).map(({ id, label, icon: Icon }) => {
            const active = mode === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id)
                  setResults([])
                  setHasSearched(false)
                  setSearchError(null)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {!hasSearched && !isSearching && (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
              {mode === 'keyword'
                ? 'Find an exact word or phrase across every branch.'
                : 'Describe an idea and Claude finds related messages, even when the wording differs. Press Enter to search.'}
            </div>
          )}

          {searchError && !isSearching && (
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--color-error-bg)',
                borderBottom: '1px solid var(--color-error-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--color-error)' }}>{searchError}</span>
              <button
                onClick={() => setSearchError(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontSize: 11, flexShrink: 0 }}
              >
                Dismiss
              </button>
            </div>
          )}

          {hasSearched && results.length === 0 && !isSearching && !searchError && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {results.map((r, i) => (
            <button
              key={r.id + i}
              onClick={() => handleResultClick(r.id, i)}
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
