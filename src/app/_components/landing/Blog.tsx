'use client'

import { ArrowRight } from 'lucide-react'

const SMALL_CARDS = [
  { label: 'Essay',      activeRight: false },
  { label: 'Field note', activeRight: true  },
  { label: 'Changelog',  activeRight: false },
]

function MiniTree({ activeRight = false }: { activeRight?: boolean }) {
  return (
    <svg viewBox="0 0 120 60" style={{ overflow: 'visible' }}>
      <g transform="translate(22, 6)">
        <rect width="76" height="22" rx="6" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
      </g>
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

function FeaturedTree() {
  return (
    <svg viewBox="0 0 200 110" style={{ overflow: 'visible' }}>
      {/* Root */}
      <g transform="translate(62, 6)">
        <rect width="76" height="26" rx="7" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
      </g>
      {/* Level 1 edges */}
      <path d="M 100 33 C 100 41 60 41 60 49"  fill="none" stroke="var(--edge-color)"  strokeWidth="1.5" />
      <path d="M 100 33 C 100 41 140 41 140 49" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
      {/* Level 1 nodes */}
      <g transform="translate(22, 50)">
        <rect width="76" height="24" rx="6" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
      </g>
      <g transform="translate(102, 50)">
        <rect width="76" height="24" rx="6" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
      </g>
      {/* Level 2 edges */}
      <path d="M 140 75 C 140 83 110 83 110 91" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
      <path d="M 140 75 C 140 83 170 83 170 91" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
      {/* Level 2 nodes */}
      <g transform="translate(72, 92)">
        <rect width="76" height="20" rx="5" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
      </g>
      <g transform="translate(132, 92)">
        <rect width="56" height="20" rx="5" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
      </g>
    </svg>
  )
}

export default function Blog() {
  return (
    <section id="blog" className="ln-blog">
      <div className="ln-container">
        <div className="ln-blog-head">
          <div className="ln-blog-head-left">
            <h2 className="ln-h2">Notes from the <em>canvas.</em></h2>
            <p className="ln-lede ln-blog-lede">
              Field notes on building Nodea, branching as a thinking pattern,
              and the small craft decisions behind every node on the canvas.
            </p>
          </div>
          <div className="ln-blog-head-right">
            <button className="ln-btn ln-btn-outline" type="button">
              Get notified <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Featured row */}
        <div className="ln-blog-featured">
          {/* Art card */}
          <div className="ln-blog-card ln-blog-card-featured-art">
            <span className="ln-blog-coming-soon">Coming soon</span>
            <div className="ln-blog-art ln-blog-art-featured">
              <FeaturedTree />
            </div>
          </div>
          {/* Featured essay text card */}
          <div className="ln-blog-card ln-blog-card-featured-text">
            <div className="ln-blog-body">
              <span className="ln-blog-meta">Featured &middot; Essay</span>
              <div className="ln-blog-skeleton ln-sk-title" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="ln-blog-skeleton ln-sk-line" />
                <div className="ln-blog-skeleton ln-sk-line" />
                <div className="ln-blog-skeleton ln-sk-line short" />
              </div>
              <div className="ln-blog-footer-row">
                <div className="ln-blog-avatar" />
                <div className="ln-blog-skeleton" style={{ height: 12, width: 80, borderRadius: 4 }} />
                <div className="ln-blog-skeleton" style={{ height: 12, width: 48, borderRadius: 4, marginLeft: 'auto' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Small cards */}
        <div className="ln-blog-grid">
          {SMALL_CARDS.map((card, i) => (
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
              </div>
            </div>
          ))}
        </div>

        <div className="ln-blog-empty">
          <p>The first post is being written. Hook up your email to hear about it the day it drops.</p>
          <form className="ln-notify-form" onSubmit={e => e.preventDefault()}>
            <input
              className="ln-notify-input"
              type="email"
              placeholder="you@thinking.com"
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
