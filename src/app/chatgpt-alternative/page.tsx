import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'

export const metadata: Metadata = {
  title: { absolute: 'ChatGPT Alternative: Branching AI Chat | Nodea AI' },
  description:
    'A ChatGPT alternative that branches. Nodea is a branching AI chat canvas on Claude — fork any reply into a node and compare paths, not one linear thread.',
  alternates: { canonical: '/chatgpt-alternative' },
  openGraph: {
    title: 'Nodea — A Branching ChatGPT Alternative',
    description:
      'A ChatGPT alternative that branches. Fork any reply into a new node, compare paths side-by-side, and run on Anthropic Claude.',
    url: 'https://nodea.ai/chatgpt-alternative',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nodea — A Branching ChatGPT Alternative',
    description: 'A ChatGPT alternative that branches. Fork any reply, compare paths, run on Claude.',
  },
}

const FAQ = [
  {
    q: 'Is Nodea a free ChatGPT alternative?',
    a: 'Nodea is free during beta with a 25,000 daily / 450,000 monthly token budget and access to Claude Haiku 4.5 and Sonnet 4.6 — no credit card required. The Pro plan is $8/month (versus ChatGPT Plus at $20/month) and unlocks Claude Opus plus a 50,000 daily / 1,000,000 monthly budget.',
  },
  {
    q: 'What makes Nodea different from ChatGPT?',
    a: 'ChatGPT gives you one linear thread per conversation. To explore an alternative you either edit a message (overwriting history) or start a new chat (losing context). Nodea stores every message as a node in a tree, so you can fork from any reply, keep both paths, and compare branches side-by-side on a pan-and-zoom canvas.',
  },
  {
    q: 'Which AI models does this ChatGPT alternative use?',
    a: 'Nodea runs exclusively on Anthropic Claude — Haiku 4.5 for fast replies, Sonnet 4.6 for balanced reasoning, and Opus for the heaviest tasks. The model is selected automatically based on prompt complexity and your plan, so you do not have to pick one manually.',
  },
  {
    q: 'Can I switch to Nodea without losing my Claude history?',
    a: 'Yes. A Chrome extension, Nodea Tree for Claude, imports your existing Claude.ai conversations into Nodea as a branching tree, so you can keep working from where you left off rather than starting from scratch.',
  },
  {
    q: 'Do I need to create an account to try it?',
    a: 'No email is required to start. Nodea supports anonymous sign-in — a real account is created without an email address, so you can open a canvas, branch, and save projects immediately, then link an email later to claim your data with no migration needed.',
  },
  {
    q: 'Can I use ChatGPT and Nodea together?',
    a: 'Yes — they are complementary. Many people keep ChatGPT for OpenAI-specific features like image generation or voice mode, and reach for Nodea whenever they need to explore alternatives, compare framings, or branch a reply without losing the original.',
  },
]

const DIFFS = [
  {
    feature: 'Conversation shape',
    chatgpt: 'One linear thread',
    nodea: 'A tree of branches you can fork from',
  },
  {
    feature: 'Exploring an alternative',
    chatgpt: 'Edit (overwrites) or start a new chat (loses context)',
    nodea: 'Fork any reply into a new node — keep every path',
  },
  {
    feature: 'Comparing answers',
    chatgpt: 'Scroll back and forth',
    nodea: 'Branches sit side-by-side on a pan-and-zoom canvas',
  },
  {
    feature: 'Underlying model',
    chatgpt: 'OpenAI GPT',
    nodea: 'Anthropic Claude — Haiku 4.5, Sonnet 4.6, Opus',
  },
  {
    feature: 'Model selection',
    chatgpt: 'Manual model picker',
    nodea: 'Automatic routing by prompt complexity',
  },
  {
    feature: 'Getting started',
    chatgpt: 'Email required',
    nodea: 'Anonymous sign-in — no email needed',
  },
  {
    feature: 'Paid tier',
    chatgpt: '$20/mo',
    nodea: '$8/mo — free during beta',
  },
]

export default function ChatGPTAlternative() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'ChatGPT Alternative: Branching AI Chat — Nodea AI',
    description:
      'Nodea is a branching ChatGPT alternative built on Anthropic Claude. Fork any reply into a node and compare paths instead of scrolling one linear thread.',
    url: 'https://nodea.ai/chatgpt-alternative',
    publisher: { '@type': 'Organization', name: 'Nodea' },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.ln-bluf-lede', '.ln-faq-a p'],
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nodea.ai/' },
      { '@type': 'ListItem', position: 2, name: 'ChatGPT Alternative', item: 'https://nodea.ai/chatgpt-alternative' },
    ],
  }

  return (
    <div className="ln-root">
      <Nav />

      <main>
        {/* ── Hero ─────────────────────────────────────── */}
        <section className="ln-hero">
          <div className="ln-container">
            <span className="ln-eyebrow">
              <span className="ln-eyebrow-dot" />
              The ChatGPT alternative that branches
            </span>
            <h1 className="ln-hero-h1">
              A ChatGPT Alternative<br />That <em>Branches.</em>
            </h1>
            <p className="ln-hero-sub">
              Nodea is a branching AI chat canvas. Every reply becomes a node you
              can fork from — your conversation grows as a tree of branches, not
              one long thread. Built on Anthropic Claude.
            </p>
            <div className="ln-hero-ctas">
              <Link href="/login" className="ln-btn ln-btn-primary ln-btn-lg">
                Open a canvas — free
              </Link>
              <Link href="/demo" className="ln-btn ln-btn-outline ln-btn-lg">
                Try the live demo
              </Link>
            </div>
            <p className="ln-hero-meta">Free during beta · No credit card · No waitlist</p>
          </div>
        </section>

        {/* ── BLUF: answer-first short answer ──────────── */}
        <section className="ln-bluf" aria-labelledby="bluf-heading">
          <div className="ln-container">
            <div className="ln-bluf-grid">
              <div className="ln-bluf-text">
                <span className="ln-kicker">The short answer</span>
                <h2 id="bluf-heading" className="ln-bluf-h2">
                  Why look past ChatGPT?
                </h2>
                <p className="ln-bluf-lede">
                  <strong>Nodea is a branching AI chat canvas.</strong> Every reply
                  becomes a node you can fork from — your conversation grows as a
                  tree of branches, not one long thread. Where ChatGPT gives you a
                  single linear path, Nodea lets you keep every alternative and
                  compare them side-by-side.
                </p>
                <p className="ln-bluf-sub">
                  It runs on Anthropic Claude (Haiku 4.5, Sonnet 4.6, Opus) with
                  automatic model routing — so you spend your time thinking, not
                  picking a model.
                </p>
              </div>

              <ul className="ln-bluf-facts" aria-label="Nodea key facts">
                <li>
                  <span className="ln-bluf-k">Conversation shape</span>
                  <span className="ln-bluf-v">A tree of branches, not one thread</span>
                </li>
                <li>
                  <span className="ln-bluf-k">Models</span>
                  <span className="ln-bluf-v">Claude Haiku 4.5 · Sonnet 4.6 · Opus</span>
                </li>
                <li>
                  <span className="ln-bluf-k">Pricing</span>
                  <span className="ln-bluf-v">Free in beta · Pro $8/mo (vs $20/mo)</span>
                </li>
                <li>
                  <span className="ln-bluf-k">Sign-up</span>
                  <span className="ln-bluf-v">Anonymous mode — no email needed</span>
                </li>
                <li>
                  <span className="ln-bluf-k">Switching</span>
                  <span className="ln-bluf-v">Import Claude.ai chats via extension</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Why people switch ────────────────────────── */}
        <section className="ln-features">
          <div className="ln-container">
            <div className="ln-features-head">
              <span className="ln-kicker">Why people switch</span>
              <h2 className="ln-h2">
                Linear chat keeps<br /><em>losing your work.</em>
              </h2>
              <p className="ln-lede ln-features-lede">
                If you have one question and want one answer, ChatGPT is fine. The
                friction shows up the moment you want to explore — and that is
                exactly where a branching canvas pays off.
              </p>
            </div>

            <div className="ln-bento">
              <div className="ln-bcard wide">
                <span className="ln-bcard-num">01</span>
                <h3>You stop losing the original</h3>
                <p>
                  In a linear thread, editing a prompt overwrites the old reply and
                  starting a new chat drops your context. In Nodea, you fork from
                  any reply into a new node — the original path stays exactly where
                  it was.
                </p>
              </div>
              <div className="ln-bcard wide">
                <span className="ln-bcard-num">02</span>
                <h3>You compare instead of scroll</h3>
                <p>
                  Two framings of the same question, three different plans, an A/B
                  on a prompt — every branch sits side-by-side on a pan-and-zoom
                  canvas, not buried in a scroll-back history.
                </p>
              </div>
              <div className="ln-bcard wide">
                <span className="ln-bcard-num">03</span>
                <h3>You get Claude, routed automatically</h3>
                <p>
                  Nodea runs on Anthropic Claude — Haiku 4.5, Sonnet 4.6, and Opus
                  — and picks the right model by prompt complexity, so you do not
                  manage a model dropdown.
                </p>
              </div>
              <div className="ln-bcard wide">
                <span className="ln-bcard-num">04</span>
                <h3>You start without commitment</h3>
                <p>
                  Anonymous sign-in means no email to try it, and the Chrome
                  extension imports your existing Claude.ai chats as a branching
                  tree — so switching does not mean starting over.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Linear vs branching contrast ─────────────── */}
        <section className="ln-contrast">
          <div className="ln-container">
            <div className="ln-contrast-head">
              <h2 className="ln-h2">Linear thread<br /><em>vs. branching canvas.</em></h2>
              <p className="ln-lede ln-contrast-lede">
                The difference is the data model. ChatGPT stores a conversation as
                a list. Nodea stores it as a tree.
              </p>
            </div>

            <div className="ln-contrast-grid">
              <div className="ln-contrast-card faded">
                <span className="ln-card-tag">ChatGPT</span>
                <h3>One thread, scrolling forever.</h3>
                <p>
                  Edit a prompt and the old reply vanishes. Try a different angle
                  and you fork into a brand-new chat. Context gets stranded between
                  conversations.
                </p>
                <div className="ln-chat-bars">
                  <div className="ln-chat-bar user" />
                  <div className="ln-chat-bar ai" />
                  <div className="ln-chat-bar user w2" style={{ opacity: 0.6 }} />
                  <div className="ln-chat-bar ai w2" style={{ opacity: 0.6 }} />
                  <div className="ln-chat-bar user" style={{ opacity: 0.3 }} />
                  <div className="ln-chat-bar ai" style={{ opacity: 0.3 }} />
                  <div className="ln-chat-bar faded" style={{ height: 60, opacity: 0.15 }} />
                </div>
              </div>

              <div className="ln-contrast-card highlighted">
                <span className="ln-card-tag">Nodea</span>
                <h3>A map of every path you took.</h3>
                <p>
                  Branch from any message to explore an alternative. Compare
                  answers side-by-side. Keep the keepers. Search across every path
                  at once — on a canvas built for Claude.
                </p>
                <div className="ln-mini-tree">
                  <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid meet">
                    <path d="M 150 36 C 150 46 80 46 80 56" fill="none" stroke="var(--edge-color)" strokeWidth="1.5" />
                    <path d="M 150 36 C 150 46 220 46 220 56" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                    <path d="M 80 82 C 80 94 50 94 50 106" fill="none" stroke="var(--edge-color)" strokeWidth="1.5" />
                    <path d="M 220 82 C 220 94 185 94 185 106" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                    <path d="M 220 82 C 220 94 255 94 255 106" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                    <g transform="translate(112, 8)">
                      <rect width="76" height="26" rx="7" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                      <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">prompt</text>
                    </g>
                    <g transform="translate(42, 56)">
                      <rect width="76" height="26" rx="7" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                      <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">draft A</text>
                    </g>
                    <g transform="translate(182, 56)">
                      <rect width="76" height="26" rx="7" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                      <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">draft B</text>
                    </g>
                    <g transform="translate(12, 106)">
                      <rect width="76" height="24" rx="6" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                      <text x="38" y="15" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">edit</text>
                    </g>
                    <g transform="translate(147, 106)">
                      <rect width="76" height="24" rx="6" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                      <text x="38" y="15" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">rewrite</text>
                    </g>
                    <g transform="translate(217, 106)">
                      <rect width="76" height="24" rx="6" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                      <text x="38" y="15" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">ship it</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Compact differences list ─────────────────── */}
        <section className="ln-features">
          <div className="ln-container">
            <div className="ln-features-head">
              <span className="ln-kicker">At a glance</span>
              <h2 className="ln-h2">ChatGPT vs. Nodea</h2>
            </div>

            <ul className="ln-bluf-facts" style={{ maxWidth: 820, margin: '0 auto' }}>
              {DIFFS.map((d) => (
                <li key={d.feature}>
                  <span className="ln-bluf-k">{d.feature}</span>
                  <span className="ln-bluf-v">
                    ChatGPT: {d.chatgpt} &nbsp;·&nbsp; Nodea: {d.nodea}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── What Nodea is not (honesty note) ─────────── */}
        <section className="ln-bluf">
          <div className="ln-container">
            <div className="ln-bluf-grid">
              <div className="ln-bluf-text">
                <span className="ln-kicker">An honest note</span>
                <h2 className="ln-bluf-h2">What Nodea is not</h2>
                <p className="ln-bluf-lede">
                  Nodea is a focused tool, not a drop-in clone of everything
                  ChatGPT does. It runs on Claude only — there is no GPT model, no
                  image generation, and no voice mode. Several things are on the
                  roadmap, not shipped, and we would rather say so than imply
                  otherwise.
                </p>
                <p className="ln-bluf-sub">
                  Bring-your-own-API-keys, plugins, full export tooling, and a
                  project-wide connected canvas are planned but not available yet.
                  If you need OpenAI-specific features today, keep ChatGPT for
                  those and use Nodea for branching.
                </p>
              </div>

              <ul className="ln-bluf-facts" aria-label="Roadmap and limitations">
                <li>
                  <span className="ln-bluf-k">Models</span>
                  <span className="ln-bluf-v">Claude only — no GPT, no image or voice</span>
                </li>
                <li>
                  <span className="ln-bluf-k">BYOK</span>
                  <span className="ln-bluf-v">On the roadmap — not shipped yet</span>
                </li>
                <li>
                  <span className="ln-bluf-k">Plugins</span>
                  <span className="ln-bluf-v">On the roadmap — not shipped yet</span>
                </li>
                <li>
                  <span className="ln-bluf-k">Full export</span>
                  <span className="ln-bluf-v">On the roadmap — not shipped yet</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────── */}
        <section id="faq" className="ln-faq" aria-labelledby="faq-heading">
          <div className="ln-container">
            <div className="ln-faq-head">
              <span className="ln-kicker">FAQ</span>
              <h2 id="faq-heading" className="ln-h2">
                ChatGPT alternative,<br /><em>questions answered.</em>
              </h2>
            </div>

            <div className="ln-faq-list">
              {FAQ.map(({ q, a }, i) => (
                <details key={q} className="ln-faq-item" open={i === 0}>
                  <summary className="ln-faq-q">{q}</summary>
                  <div className="ln-faq-a">
                    <p>{a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────── */}
        <section className="ln-cta">
          <div className="ln-container">
            <h2 className="ln-h2">
              Stop scrolling.<br />Start <em>branching.</em>
            </h2>
            <p className="ln-cta-sub">
              Free during beta — no credit card, no waitlist. Branch any reply
              across Claude Haiku, Sonnet, and Opus on managed keys.
            </p>
            <div className="ln-cta-btns">
              <Link href="/login" className="ln-btn ln-btn-primary ln-btn-lg">
                Open your first canvas
              </Link>
              <Link href="/demo" className="ln-btn ln-btn-outline ln-btn-lg">
                Try the live demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </div>
  )
}
