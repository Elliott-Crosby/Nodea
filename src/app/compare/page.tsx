import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import './compare.css'

const SITE_URL = 'https://nodea.ai'

interface CompareEntry {
  slug: string
  competitor: string
  title: string
  blurb: string
}

// Every published /compare/* page. Order is the on-page card order and the
// ItemList position order, so AI engines and crawlers see one canonical list.
const COMPARISONS: CompareEntry[] = [
  {
    slug: 'nodea-vs-chatgpt',
    competitor: 'ChatGPT',
    title: 'Nodea vs ChatGPT',
    blurb:
      'The default linear chatbot vs a tree-shaped canvas. Branching, model routing, data ownership, and price — when each one wins.',
  },
  {
    slug: 'nodea-vs-claude-projects',
    competitor: 'Claude Projects',
    title: 'Nodea vs Claude Projects',
    blurb:
      'Both run on Claude. One optimizes for persistent project context, the other for non-linear exploration. How to choose.',
  },
  {
    slug: 'nodea-vs-typingmind',
    competitor: 'TypingMind',
    title: 'Nodea vs TypingMind',
    blurb:
      'A multi-provider bring-your-own-key frontend vs a branching canvas on Claude with automatic model routing and zero setup.',
  },
  {
    slug: 'nodea-vs-perplexity',
    competitor: 'Perplexity',
    title: 'Nodea vs Perplexity',
    blurb:
      'Answer-engine search with citations vs a branching AI chat canvas for exploring and comparing alternatives side by side.',
  },
  {
    slug: 'nodea-vs-librechat',
    competitor: 'LibreChat',
    title: 'Nodea vs LibreChat',
    blurb:
      'A self-hosted multi-model chat UI vs a hosted, zero-setup branching canvas on Claude. Setup, models, and workflow compared.',
  },
  {
    slug: 'nodea-vs-msty',
    competitor: 'Msty',
    title: 'Nodea vs Msty',
    blurb:
      'A local-first desktop client for many models vs a branching AI chat canvas built for non-linear thinking on Claude.',
  },
  {
    slug: 'nodea-vs-poe',
    competitor: 'Poe',
    title: 'Nodea vs Poe',
    blurb:
      'A multi-bot aggregator with one linear thread per bot vs a tree-shaped canvas where every reply becomes a node you can fork.',
  },
]

export const metadata: Metadata = {
  title: { absolute: 'Nodea vs the Alternatives — Honest Comparisons' },
  description:
    'Honest, side-by-side comparisons of Nodea AI against ChatGPT, Claude Projects, Perplexity, TypingMind, LibreChat, Msty, and Poe. When each tool wins.',
  alternates: { canonical: '/compare' },
  openGraph: {
    title: 'Nodea vs the Alternatives — Honest Comparisons',
    description:
      'Side-by-side comparisons of Nodea AI against ChatGPT, Claude Projects, Perplexity, and more. When each tool wins, and how to decide.',
    url: `${SITE_URL}/compare`,
    type: 'website',
  },
}

export default function CompareIndex() {
  // ItemList enumerates every comparison so AI engines can pull the full set
  // of available head-to-heads in one structured shot.
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Nodea comparisons — all alternatives',
    numberOfItems: COMPARISONS.length,
    itemListElement: COMPARISONS.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/compare/${c.slug}`,
      name: c.title,
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE_URL}/compare` },
    ],
  }

  return (
    <div className="ln-root cmp-root">
      <Nav />
      <main>
        <section className="cmp-hero">
          <div className="ln-container">
            <span className="ln-kicker">Honest comparisons</span>
            <h1 className="cmp-h1">Nodea vs the alternatives.</h1>
            <p className="cmp-lede">
              Nodea is a branching AI chat canvas. Every reply becomes a node you
              can fork from — your conversation grows as a tree of branches, not
              one long thread. Here&rsquo;s how it stacks up against the tools you
              already know, without the marketing fluff.
            </p>
          </div>
        </section>

        <section className="cmp-table-wrap">
          <div className="ln-container">
            <div className="cmp-grid">
              {COMPARISONS.map((c) => (
                <Link key={c.slug} href={`/compare/${c.slug}`} className="cmp-card">
                  <span className="cmp-card-pill">vs {c.competitor}</span>
                  <h2 className="cmp-card-title">{c.title}</h2>
                  <p className="cmp-card-desc">{c.blurb}</p>
                  <span className="cmp-card-arrow">Read the comparison →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="cmp-cta">
          <h2>Skip the comparison — just try it.</h2>
          <p>Free during beta. No credit card. No waitlist.</p>
          <Link href="/login" className="ln-btn ln-btn-primary ln-btn-lg">
            Open a Nodea canvas
          </Link>
        </section>
      </main>
      <Footer />

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
