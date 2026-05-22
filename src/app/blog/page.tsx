import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import './blog.css'
import { POSTS } from './posts'

export const metadata: Metadata = {
  title: 'Blog — Branching AI, Claude, and Non-Linear Thinking',
  description:
    'Essays and guides on branching AI chat, prompt design, Claude vs ChatGPT, and the craft of building a tree-shaped conversation tool.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Nodea Blog — Branching AI Chat',
    description:
      'Essays and guides on branching AI chat, prompt design, Claude vs ChatGPT, and non-linear AI workflows.',
    url: 'https://nodea.ai/blog',
    type: 'website',
  },
}

export default function BlogIndex() {
  return (
    <div className="ln-root bl-root">
      <Nav />
      <main>
        <section className="bl-hero">
          <div className="ln-container">
            <span className="ln-kicker">Notes from the canvas</span>
            <h1 className="bl-h1">Branching AI, in plain words.</h1>
            <p className="bl-lede">
              Essays on non-linear thinking, prompt design, Claude vs ChatGPT,
              and the craft decisions behind a tree-shaped chat tool.
            </p>
          </div>
        </section>

        <section className="bl-list">
          <div className="ln-container">
            <div className="bl-grid">
              {POSTS.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="bl-card">
                  <div className="bl-card-meta">
                    <span className="bl-pill">{p.category}</span>
                    <span className="bl-read">{p.readMinutes} min read</span>
                  </div>
                  <h2 className="bl-card-title">{p.title}</h2>
                  <p className="bl-card-desc">{p.description}</p>
                  <div className="bl-card-foot">
                    <time dateTime={p.publishedAt}>
                      {new Date(p.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                    <span className="bl-arrow">Read →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
