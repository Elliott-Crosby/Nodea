import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { POSTS } from '@/app/blog/posts'

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
  const [featured, ...rest] = POSTS
  const small = rest.slice(0, 3)

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
            <Link href="/blog" className="ln-btn ln-btn-outline">
              Read the blog <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Featured row */}
        <div className="ln-blog-featured">
          {/* Art card */}
          <Link
            href={`/blog/${featured.slug}`}
            className="ln-blog-card ln-blog-card-featured-art ln-blog-card-link"
          >
            <span className="ln-blog-coming-soon">{featured.category}</span>
            <div className="ln-blog-art ln-blog-art-featured">
              <FeaturedTree />
            </div>
          </Link>
          {/* Featured essay text card */}
          <Link
            href={`/blog/${featured.slug}`}
            className="ln-blog-card ln-blog-card-featured-text ln-blog-card-link"
          >
            <div className="ln-blog-body">
              <span className="ln-blog-meta">Featured &middot; {featured.category}</span>
              <h3 className="ln-blog-title">{featured.title}</h3>
              <p className="ln-blog-desc">{featured.description}</p>
              <div className="ln-blog-footer-row">
                <span className="ln-blog-meta">{featured.readMinutes} min read</span>
                <span className="ln-blog-readmore">Read &rarr;</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Small cards */}
        <div className="ln-blog-grid">
          {small.map((p, i) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="ln-blog-card ln-blog-card-link"
            >
              <div className="ln-blog-art">
                <MiniTree activeRight={i % 2 === 1} />
              </div>
              <div className="ln-blog-body">
                <span className="ln-blog-meta">{p.category} &middot; {p.readMinutes} min</span>
                <h3 className="ln-blog-title ln-blog-title-sm">{p.title}</h3>
                <p className="ln-blog-desc ln-blog-desc-sm">{p.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="ln-blog-empty">
          <p>
            {POSTS.length} guides and essays on branching AI chat, prompt design,
            and non-linear thinking &mdash; with more on the way.
          </p>
          <Link href="/blog" className="ln-btn ln-btn-primary">
            Read all posts <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}
