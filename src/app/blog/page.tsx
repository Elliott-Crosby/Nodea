import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import './blog.css'
import { POSTS } from './posts'

const SITE_URL = 'https://nodea.ai'

export const metadata: Metadata = {
  title: 'Blog — Branching AI, Claude, and Non-Linear Thinking',
  description:
    'Essays and guides on branching AI chat, prompt design, Claude vs ChatGPT, and the craft of building a tree-shaped conversation tool.',
  alternates: {
    canonical: '/blog',
    types: { 'application/rss+xml': `${SITE_URL}/feed.xml` },
  },
  openGraph: {
    title: 'Nodea Blog — Branching AI Chat',
    description:
      'Essays and guides on branching AI chat, prompt design, Claude vs ChatGPT, and non-linear AI workflows.',
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
}

export default function BlogIndex() {
  // Blog schema describes the publication; ItemList enumerates posts so
  // AI engines can pull a structured list of available articles in one shot.
  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/blog#blog`,
    name: 'Nodea Blog',
    description:
      'Essays and guides on branching AI chat, prompt design, Claude vs ChatGPT, and non-linear AI workflows.',
    url: `${SITE_URL}/blog`,
    publisher: { '@type': 'Organization', name: 'Nodea', url: SITE_URL },
    blogPost: POSTS.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.description,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      dateModified: p.updatedAt ?? p.publishedAt,
      keywords: p.keywords.join(', '),
      author: { '@type': 'Organization', name: 'Nodea' },
      mainEntityOfPage: `${SITE_URL}/blog/${p.slug}`,
    })),
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Nodea Blog — all posts',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: POSTS.length,
    itemListElement: POSTS.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/blog/${p.slug}`,
      name: p.title,
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
    ],
  }

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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </div>
  )
}
