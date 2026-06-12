import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import './ai-chat-canvas.css'
import { OG_IMAGES, TWITTER_IMAGES } from '@/lib/og'

export const metadata: Metadata = {
  title: { absolute: 'AI Chat Canvas — Nodea AI' },
  description:
    'Nodea is a visual AI chat canvas: fork any reply into a new branch, pan and zoom a tree of your conversation, and compare paths side-by-side. Built on Claude.',
  alternates: { canonical: '/ai-chat-canvas' },
  openGraph: {
    title: 'AI Chat Canvas — Visual, Branching AI Chat | Nodea AI',
    description:
      'A canvas for AI conversations instead of one long thread. Fork any reply, map your chat as a tree, and compare branches side-by-side. Built on Claude.',
    url: 'https://nodea.ai/ai-chat-canvas',
    type: 'article',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Chat Canvas — Nodea AI',
    description: 'A visual, branching canvas for AI conversations. Built on Claude.',
    images: TWITTER_IMAGES,
  },
}

const FAQ = [
  {
    q: 'What is an AI chat canvas?',
    a: 'An AI chat canvas is a visual, non-linear interface for talking to an AI. Instead of one scrolling thread, your conversation is laid out as a tree on a pan-and-zoom surface. Nodea is a branching AI chat canvas: every reply becomes a node you can fork from, so you can explore alternatives without losing the original path.',
  },
  {
    q: 'How is a canvas different from a normal AI chat thread?',
    a: 'A thread is a single line: each new message is appended, and exploring an alternative means either overwriting an earlier message or starting a fresh chat and losing context. A canvas keeps every message as a node in a tree. You can branch from any point, see all the directions you took at once, and switch between them instantly.',
  },
  {
    q: 'Which AI models power the Nodea canvas?',
    a: 'Nodea runs on Anthropic Claude only: Haiku 4.5 for fast replies, Sonnet 4.6 for balanced work, and Opus for the heaviest reasoning. The model is routed automatically based on the complexity of your prompt and your plan.',
  },
  {
    q: 'Can I compare AI responses side-by-side on the canvas?',
    a: 'Yes. Because every branch is an independent path in the tree, you can ask the same question two or three different ways, keep all the answers, and compare them on the canvas. No branch overwrites another, and nothing from a sibling branch leaks into the prompt.',
  },
  {
    q: 'Do I need to sign up to try the canvas?',
    a: 'No email is required to start. Nodea supports anonymous sign-in through Supabase, so you can open a canvas, branch, and save your tree right away. You can later link an email to keep your work, with no data migration needed.',
  },
  {
    q: 'Is the AI chat canvas free?',
    a: 'Yes. Nodea is free during beta with roughly 25,000 daily and 450,000 monthly tokens, and no credit card. The $8/month Pro plan unlocks Claude Opus and a larger token budget.',
  },
  {
    q: 'Can I import my existing Claude chats onto the canvas?',
    a: 'Yes. The "Nodea Tree for Claude" Chrome extension imports your Claude.ai conversations into Nodea as a branching tree, so you can keep exploring them on the canvas instead of in a flat thread.',
  },
]

const WHO = [
  {
    title: 'Writers and editors',
    body: 'Draft three openings from the same brief, keep all of them on the canvas, and pick the one that lands. The others stay put.',
  },
  {
    title: 'Researchers and analysts',
    body: 'Branch a question into competing hypotheses and follow each one down its own path. Every line of inquiry stays visible and comparable.',
  },
  {
    title: 'Founders and product teams',
    body: 'Explore several plans from one starting prompt, compare the trade-offs branch by branch, and never re-type context you already gave the model.',
  },
  {
    title: 'Engineers',
    body: 'A/B test prompts, fork an answer to try a different framing, and map a debugging session as a tree instead of a wall of back-and-forth.',
  },
]

export default function AiChatCanvas() {
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
    name: 'AI Chat Canvas — Visual, Branching AI Chat',
    description:
      'Nodea is a visual AI chat canvas built on Claude. Fork any reply into a new branch, pan and zoom a tree of your conversation, and compare paths side-by-side.',
    url: 'https://nodea.ai/ai-chat-canvas',
    inLanguage: 'en-US',
    isPartOf: { '@id': 'https://nodea.ai/#website' },
    about: { '@id': 'https://nodea.ai/#organization' },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.cc-lede', '.cc-faq-item p'],
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',           item: 'https://nodea.ai/' },
      { '@type': 'ListItem', position: 2, name: 'AI Chat Canvas',  item: 'https://nodea.ai/ai-chat-canvas' },
    ],
  }

  return (
    <div className="ln-root cc-root">
      <Nav />

      <main>
        {/* ── Hero ─────────────────────────────────────── */}
        <section className="cc-hero">
          <div className="ln-container">
            <span className="ln-kicker">A canvas, not a thread</span>
            <h1 className="cc-h1">Your AI Chat, on a Canvas</h1>
            <p className="cc-lede">
              <strong>
                Nodea is a branching AI chat canvas. Every reply becomes a node
                you can fork from. Your conversation grows as a tree of
                branches, not one long thread.
              </strong>
            </p>
            <p className="cc-lede cc-lede-sub">
              Pan and zoom across the whole tree, fork any answer into a new
              direction, and compare branches side-by-side. Every path you
              explore stays on the canvas, exactly where you left it.
            </p>

            <div className="cc-ctas">
              <Link href="/login?mode=signup" className="ln-btn ln-btn-primary ln-btn-lg">
                Open a canvas — free
              </Link>
              <Link href="/what-is-nodea" className="ln-btn ln-btn-outline ln-btn-lg">
                How it works
              </Link>
            </div>
          </div>
        </section>

        {/* ── Thread vs canvas contrast ────────────────── */}
        <section className="cc-contrast">
          <div className="ln-container">
            <div className="cc-contrast-grid">
              <div className="cc-card cc-card-thread">
                <p className="cc-card-label">A linear thread</p>
                <ul>
                  <li>Each new message is appended. The latest reply is all you see.</li>
                  <li>Exploring an alternative means <strong>overwriting</strong> an earlier message or starting over.</li>
                  <li>Earlier ideas get buried in the scroll and are easy to lose.</li>
                  <li>You re-type context the model already had.</li>
                </ul>
              </div>
              <div className="cc-card cc-card-canvas">
                <p className="cc-card-label">A Nodea canvas</p>
                <ul>
                  <li>A pan-and-zoom <strong>tree</strong>: every message is a node you can see at once.</li>
                  <li>Fork any reply into a new branch; the original <strong>stays put</strong>.</li>
                  <li>Every direction you took is kept and laid out visually.</li>
                  <li>Each branch carries its own path from the root. No re-typing.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── What a canvas changes ────────────────────── */}
        <section className="cc-deep">
          <div className="ln-container cc-prose">
            <span className="ln-kicker">What a canvas changes</span>
            <h2 className="cc-h2">From a single line to a map of your thinking</h2>

            <p>
              Most AI chat tools (ChatGPT, Claude.ai, and the rest) give you a
              single linear thread per conversation. That works for one question
              and one answer. The moment you want to explore an alternative, the
              thread fights you: you either edit an earlier message and overwrite
              what was there, or you open a fresh chat and leave all your context
              behind.
            </p>
            <p>
              A canvas changes the shape of the conversation. On the Nodea canvas
              your chat is a tree of nodes, rendered on a free pan-and-zoom
              surface. You can stand back and see every direction you took, zoom
              into any one of them, and branch a new path from any point. Nothing
              is overwritten and nothing is lost in the scroll. The structure of
              your thinking is right there in front of you.
            </p>

            <h3 className="cc-h3">How branching works</h3>
            <p>
              Every message, yours and the AI&rsquo;s, is a node in the tree.
              To branch, you pick any existing node and ask a new question from
              there. That creates a child node, and a new path is born. The
              prompt sent to Claude for any node is <em>the path from the root to
              that node</em>, not the entire tree and never a sibling branch, so
              each branch is completely independent.
            </p>
            <ul>
              <li>
                <strong>Fork any reply.</strong> Click a node and ask again to
                spin off an alternative. The original answer stays exactly where
                it was.
              </li>
              <li>
                <strong>Pan and zoom the tree.</strong> The whole conversation is
                one canvas you can move around freely, however large it grows.
              </li>
              <li>
                <strong>Compare branches side-by-side.</strong> Ask the same thing
                three different ways, keep all three answers, and judge them
                against each other.
              </li>
              <li>
                <strong>Keep every path.</strong> Nothing is overwritten. Every
                branch you have ever explored is saved in your tree.
              </li>
            </ul>

            <h3 className="cc-h3">Built on Claude, routed automatically</h3>
            <p>
              The canvas runs on Anthropic Claude only: Haiku 4.5 for fast
              replies, Sonnet 4.6 for balanced work, and Opus for the heaviest
              reasoning. Nodea routes to the right model automatically based on
              the complexity of your prompt and your plan, so you can stay focused
              on the branch you&rsquo;re exploring rather than fiddling with a model
              picker.
            </p>

            <h3 className="cc-h3">Your conversations, grouped and isolated</h3>
            <p>
              Conversations live in projects, and your data lives in your own
              Supabase row, isolated by row-level security. Anonymous sign-in lets
              you start without an email, and the &ldquo;Nodea Tree for Claude&rdquo;
              Chrome extension can import your existing Claude.ai chats onto the
              canvas as a branching tree. Plugins and full export tooling are on
              the roadmap, not shipped yet, but where the canvas is headed.
            </p>
          </div>
        </section>

        {/* ── Who it's for ─────────────────────────────── */}
        <section className="cc-who">
          <div className="ln-container cc-prose">
            <span className="ln-kicker">Who it&rsquo;s for</span>
            <h2 className="cc-h2">A canvas for people who think by exploring</h2>
            <p>
              If you only ever ask one question and take the first answer, a
              thread is fine. The canvas earns its keep the moment you start
              comparing alternatives, testing framings, or following more than one
              idea at a time.
            </p>
            <div className="cc-who-grid">
              {WHO.map((w) => (
                <div key={w.title} className="cc-who-card">
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────── */}
        <section className="cc-faq">
          <div className="ln-container cc-prose">
            <span className="ln-kicker">FAQ</span>
            <h2 className="cc-h2">Frequently asked questions</h2>
            <div className="cc-faq-list">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="cc-faq-item">
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────── */}
        <section className="cc-cta">
          <div className="ln-container">
            <h2 className="cc-h2 cc-cta-h2">Trade the thread for a canvas</h2>
            <p className="cc-cta-sub">Free during beta. No credit card. No waitlist.</p>
            <div className="cc-ctas">
              <Link href="/login?mode=signup" className="ln-btn ln-btn-primary ln-btn-lg">
                Open your first canvas
              </Link>
              <Link href="/upgrade" className="ln-btn ln-btn-outline ln-btn-lg">
                See pricing
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
