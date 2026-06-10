import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'

export interface ComparisonRow {
  feature: string
  competitor: string
  nodea: string
  nodeaWins?: boolean
}

export interface ComparePageProps {
  slug: string
  competitorName: string
  title: string
  description: string
  tldr: string
  rows: ComparisonRow[]
  whenCompetitor: { heading: string; bullets: string[] }
  whenNodea: { heading: string; bullets: string[] }
  faq: { q: string; a: string }[]
}

export default function ComparePage(props: ComparePageProps) {
  const { slug, competitorName, title, description, tldr, rows, whenCompetitor, whenNodea, faq } = props

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nodea.ai/' },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: 'https://nodea.ai/compare' },
      { '@type': 'ListItem', position: 3, name: title, item: `https://nodea.ai/compare/${slug}` },
    ],
  }

  return (
    <div className="ln-root cmp-root">
      <Nav />
      <main>
        <section className="cmp-hero">
          <div className="ln-container">
            <span className="ln-kicker">Honest comparison</span>
            <h1 className="cmp-h1">{title}</h1>
            <p className="cmp-lede">{description}</p>

            <div className="cmp-tldr">
              <h2>TL;DR</h2>
              <p>{tldr}</p>
            </div>
          </div>
        </section>

        <section className="cmp-table-wrap">
          <div className="ln-container">
            <div className="cmp-table">
              <div className="cmp-row cmp-row-head">
                <span>Feature</span>
                <span>{competitorName}</span>
                <span className="cmp-col-mine">Nodea</span>
              </div>
              {rows.map((r) => (
                <div key={r.feature} className="cmp-row">
                  <span className="cmp-feature">{r.feature}</span>
                  <span className="cmp-cell" data-label={competitorName}>{r.competitor}</span>
                  <span
                    className={`cmp-cell ${r.nodeaWins ? 'cmp-cell-yes' : ''}`}
                    data-label="Nodea"
                  >
                    {r.nodea}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="ln-container cmp-prose">
            <h2>{whenCompetitor.heading}</h2>
            <ul>
              {whenCompetitor.bullets.map((b, i) => (<li key={i}>{b}</li>))}
            </ul>

            <h2>{whenNodea.heading}</h2>
            <ul>
              {whenNodea.bullets.map((b, i) => (<li key={i}>{b}</li>))}
            </ul>
          </div>
        </section>

        <section>
          <div className="ln-container cmp-faq">
            <h2>Frequently asked</h2>
            {faq.map(({ q, a }) => (
              <details key={q} className="cmp-faq-item">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <div className="ln-container cmp-prose">
            <h2>Related reading</h2>
            <ul>
              <li><Link href="/what-is-nodea">What is Nodea? The branching AI chat canvas explained</Link></li>
              <li><Link href="/blog/branching-ai-chat-guide">The complete guide to branching AI chat</Link></li>
              <li><Link href="/demo">Try the live branching demo, no sign-up needed</Link></li>
            </ul>
          </div>
        </section>

        <section className="cmp-cta">
          <h2>See for yourself in 30 seconds.</h2>
          <p>Free during beta. No credit card. No waitlist.</p>
          <Link href="/login?mode=signup" className="ln-btn ln-btn-primary ln-btn-lg">
            Open a Nodea canvas
          </Link>
        </section>
      </main>
      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </div>
  )
}
