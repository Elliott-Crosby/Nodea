'use client'

import { ArrowRight } from 'lucide-react'

const CARDS = [
  { label: 'Featured · Essay', footerDate: 'Coming soon', activeRight: false },
  { label: 'Field note',        footerDate: 'Drafting',    activeRight: true  },
  { label: 'Changelog',         footerDate: 'Up next',     activeRight: false },
]

function MiniTree({ activeRight = false }: { activeRight?: boolean }) {
  return (
    <svg viewBox="0 0 120 60" width="120" height="60" style={{ overflow: 'visible' }}>
      <g transform="translate(22, 6)">
        <rect width="76" height="22" rx="6" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
      </g>
      {/* Bézier edges */}
      <path
        d="M 60 28 C 60 31 28 31 28 34"
        fill="none"
        stroke={activeRight ? 'var(--edge-color)' : 'var(--edge-active)'}
        strokeWidth="1.5"
      />
      <path
        d="M 60 28 C 60 31 90 31 90 34"
        fill="none"
        stroke={activeRight ? 'var(--edge-active)' : 'var(--edge-color)'}
        strokeWidth="1.5"
      />
      <g transform="translate(0, 34)" style={{ opacity: activeRight ? 0.5 : 1 }}>
        <rect x="0" width="56" height="20" rx="5" fill={activeRight ? 'var(--bg-muted)' : 'var(--accent-bg)'} stroke={activeRight ? 'var(--border)' : 'var(--accent)'} strokeWidth="1" />
      </g>
      <g transform="translate(62, 34)" style={{ opacity: activeRight ? 1 : 0.5 }}>
        <rect width="56" height="20" rx="5" fill={activeRight ? 'var(--accent-bg)' : 'var(--bg-muted)'} stroke={activeRight ? 'var(--accent)' : 'var(--border)'} strokeWidth="1" />
      </g>
    </svg>
  )
}

export default function Blog() {
  return (
    <section id="blog" className="ln-blog">
      <div className="ln-container">
        <div className="ln-blog-head">
          <span className="ln-kicker">Blog</span>
          <h2 className="ln-h2">Notes from the <em>canvas.</em></h2>
          <p className="ln-lede ln-blog-lede">
            Thinking about thinking — essays, field notes, and updates
            from building Nodea.
          </p>
          <div className="ln-blog-head-ctas">
            <button className="ln-btn ln-btn-outline" type="button">
              Get notified <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="ln-blog-grid">
          {CARDS.map((card, i) => (
            <div key={i} className="ln-blog-card">
              <div className="ln-blog-art">
                <MiniTree activeRight={card.activeRight} />
              </div>
              <div className="ln-blog-body">
                <span className="ln-blog-meta">{card.label}</span>
                <div className="ln-blog-skeleton ln-sk-title" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="ln-blog-skeleton ln-sk-line" />
                  <div className="ln-blog-skeleton ln-sk-line short" />
                </div>
                <div className="ln-blog-footer">{card.footerDate}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="ln-blog-empty">
          <p>Posts are on the way — drop your email and we&apos;ll let you know when the first one lands.</p>
          <form className="ln-notify-form" onSubmit={e => e.preventDefault()}>
            <input
              className="ln-notify-input"
              type="email"
              placeholder="you@example.com"
            />
            <button className="ln-btn ln-btn-primary" type="submit">
              Notify me
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
