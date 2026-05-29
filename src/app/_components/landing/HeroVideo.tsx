'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play, Volume2, GitBranch, Layers, X } from 'lucide-react'

const VIDEO_ID = 'QJrIkAfZxrE'

export default function HeroVideo() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const previewSrc =
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}` +
    `?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}&controls=0&modestbranding=1` +
    `&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1`

  return (
    <section className="ln-split">
      <div className="ln-split-glow" aria-hidden="true" />
      <div className="ln-container ln-split-grid">
        <div className="ln-split-left">
          <span className="ln-wordmark" aria-label="Nodea">Nodea</span>
          <h1 className="ln-hero-h1 ln-split-h1">
            Stop scrolling.<br />Start <em>branching.</em>
          </h1>
          <p className="ln-hero-sub ln-split-sub">
            Fork any reply into its own path. Compare branches side-by-side.
            Keep every thread you ever explored.
          </p>
          <div className="ln-split-ctas">
            <Link href="/login" className="ln-btn ln-btn-primary ln-btn-lg">
              Create your first canvas
            </Link>
            <button
              type="button"
              className="ln-btn ln-btn-outline ln-btn-lg"
              onClick={() => setOpen(true)}
            >
              <Play size={18} /> Watch demo
            </button>
          </div>
          <div className="ln-split-chips">
            <span className="ln-split-chip"><GitBranch size={14} /> Fork any reply</span>
            <span className="ln-split-chip"><Layers size={14} /> Compare branches</span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          className="ln-split-frame"
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          aria-label="Play Nodea demo with sound"
        >
          <div className="ln-split-aspect">
            <iframe
              className="ln-split-media"
              src={previewSrc}
              title=""
              tabIndex={-1}
              aria-hidden="true"
              allow="autoplay; encrypted-media"
            />
            <span className="ln-split-scrim" aria-hidden="true" />
            <span className="ln-split-sound">
              <Volume2 size={15} /> Tap for sound
            </span>
          </div>
        </div>
      </div>

      {open && (
        <div className="ln-cine-modal" onClick={() => setOpen(false)}>
          <div className="ln-cine-modal-frame" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ln-cine-modal-close"
              onClick={() => setOpen(false)}
              aria-label="Close video"
            >
              <X size={16} /> Close · Esc
            </button>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              title="Nodea — branching AI chat canvas"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </section>
  )
}
