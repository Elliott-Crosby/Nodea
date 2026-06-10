import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { POSTS } from '@/app/blog/posts'

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
            <div className="ln-blog-art ln-blog-art-photo ln-blog-art-featured">
              <img src={featured.image} alt={featured.imageAlt} loading="lazy" />
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
          {small.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="ln-blog-card ln-blog-card-link"
            >
              <div className="ln-blog-art ln-blog-art-photo">
                <img src={p.image} alt={p.imageAlt} loading="lazy" />
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
