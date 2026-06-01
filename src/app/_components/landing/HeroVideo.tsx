'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play, GitBranch, Layers, X } from 'lucide-react'
import SocialLinks from './SocialLinks'

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

  const posterSrc = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`
  const modalSrc =
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}` +
    `?autoplay=1&rel=0&modestbranding=1&playsinline=1&vq=hd1080&hd=1`

  return (
    <section className="ln-split">
      <div className="ln-split-glow" aria-hidden="true" />
      <div className="ln-container ln-split-inner">
        <div className="ln-split-grid">
          <div className="ln-split-left">
            <span className="ln-wordmark" aria-label="Nodea">Nodea</span>
            <a
              href="https://www.producthunt.com/products/nodea?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-nodea"
              target="_blank"
              rel="noopener noreferrer"
              className="ln-split-ph"
            >
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1159548&theme=light&t=1780252758064"
                alt="Nodea - Branch any AI reply. Explore ideas as a tree, not a thread. | Product Hunt"
                width={250}
                height={54}
              />
            </a>
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
              <Link href="/demo" className="ln-btn ln-btn-outline ln-btn-lg">
                Try it live →
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
            aria-label="Play Nodea demo"
          >
            <div className="ln-split-aspect">
              <img
                className="ln-split-media"
                src={posterSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <span className="ln-split-scrim" aria-hidden="true" />
              <span className="ln-split-play" aria-hidden="true">
                <Play size={28} fill="currentColor" />
              </span>
              <span className="ln-split-sound">
                <Play size={13} fill="currentColor" /> Watch demo
              </span>
            </div>
          </div>
        </div>

        <SocialLinks className="ln-hero-social" />
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
              src={modalSrc}
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
