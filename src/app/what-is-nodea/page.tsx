import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import './what-is-nodea.css'
import { OG_IMAGES, TWITTER_IMAGES } from '@/lib/og'

export const metadata: Metadata = {
  title: 'What is Nodea? Branching AI Chat Explained',
  description:
    'Nodea is a branching AI chat canvas — every reply becomes a node you can fork from, so your conversation grows as a tree of branches, not one long thread.',
  alternates: { canonical: '/what-is-nodea' },
  openGraph: {
    title: 'What is Nodea? Branching AI Chat Explained',
    description:
      'A non-linear, tree-based interface for AI conversations. Fork any reply, compare branches side-by-side, and never lose context again.',
    url: 'https://nodea.ai/what-is-nodea',
    type: 'article',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What is Nodea? Branching AI Chat Explained',
    description: 'A non-linear, tree-based interface for AI conversations.',
    images: TWITTER_IMAGES,
  },
}

const FAQ = [
  {
    q: 'What is Nodea in one sentence?',
    a: "Nodea is a branching AI chat canvas: instead of one linear thread, your conversation grows as a tree of nodes, and you can fork from any reply to explore alternatives without losing the original.",
  },
  {
    q: 'How is Nodea different from ChatGPT or Claude?',
    a: 'ChatGPT and Claude give you one linear thread per conversation. To explore an alternative, you either edit the last message (overwriting history) or start a new chat (losing context). Nodea stores every message as a node in a tree, so any point in the conversation can become a new branch.',
  },
  {
    q: 'Which AI models does Nodea use?',
    a: 'Nodea routes to Anthropic Claude models — Haiku 4.5 for fast replies, Sonnet 4.6 for balanced tasks, and Opus 4.7 for the heaviest reasoning. The model is selected automatically based on prompt complexity and your plan.',
  },
  {
    q: 'Is Nodea free?',
    a: 'Yes — Nodea is free during beta with 25,000 daily / 450,000 monthly tokens and access to Haiku and Sonnet. The $8/month Pro plan unlocks Claude Opus, a 50,000 daily / 1,000,000 monthly token budget, and early access to new features.',
  },
  {
    q: 'Is Nodea open source?',
    a: 'Yes — the Nodea source is MIT-licensed and available on GitHub. The hosted product runs at nodea.ai; you can self-host the same codebase against your own Supabase project and Anthropic API key.',
  },
  {
    q: 'Can I bring my own Anthropic API key?',
    a: 'Bring-your-own-key support is on the roadmap. Today, the hosted version uses Nodea-managed keys with per-plan token budgets.',
  },
  {
    q: 'What tech is Nodea built on?',
    a: 'Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Supabase for auth and Postgres, the Vercel AI SDK v6 for streaming, and the Anthropic SDK for Claude.',
  },
]

const STACK = [
  { layer: 'Framework',       tech: 'Next.js 16.2 (App Router) + React 19',           note: 'Streaming Server Components, route-level metadata, dynamic OG generation' },
  { layer: 'Language',        tech: 'TypeScript 5',                                   note: 'Strict mode, end-to-end types from DB schema to UI' },
  { layer: 'Styling',         tech: 'Tailwind CSS v4 + CSS variable theming',         note: 'Light/dark theme via data-theme attribute, FOUC prevention' },
  { layer: 'Database',        tech: 'Supabase Postgres',                              note: 'Row-level security, two tables: projects (conversations) and nodes (messages)' },
  { layer: 'Auth',            tech: 'Supabase Auth',                                  note: 'Email/password plus anonymous sign-in for friction-free trials' },
  { layer: 'AI streaming',    tech: 'Vercel AI SDK v6 (`ai` + `@ai-sdk/anthropic`)',  note: 'Token-by-token streaming, server-side rate limiting' },
  { layer: 'Models',          tech: 'Anthropic Claude — Haiku 4.5, Sonnet 4.6, Opus 4.7', note: 'Auto-routing by prompt complexity and plan tier' },
  { layer: 'Billing',         tech: 'Stripe Checkout + Customer Portal',              note: 'Webhook-driven plan updates, no manual reconciliation' },
  { layer: 'Canvas',          tech: 'XYFlow (React Flow)',                            note: 'Free pan + zoom over an arbitrary-size tree' },
  { layer: 'Deployment',      tech: 'Vercel',                                         note: 'Edge functions for streaming, Speed Insights, Web Analytics' },
]

export default function WhatIsNodea() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'What is Nodea? Branching AI Chat Explained',
    description:
      'A complete technical explanation of Nodea — a branching AI chat canvas built on Claude, Next.js, and Supabase. Architecture, data model, routing, streaming, and stack.',
    author: { '@type': 'Organization', name: 'Nodea' },
    publisher: { '@type': 'Organization', name: 'Nodea' },
    mainEntityOfPage: 'https://nodea.ai/what-is-nodea',
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',          item: 'https://nodea.ai/' },
      { '@type': 'ListItem', position: 2, name: 'What is Nodea', item: 'https://nodea.ai/what-is-nodea' },
    ],
  }

  // Speakable: hint to voice / AI Overviews about which selectors hold
  // the canonical short answer + the FAQ answers (all visible content).
  const speakableJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: 'https://nodea.ai/what-is-nodea',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.wn-lede', '.wn-tldr-list', '.wn-faq-item p'],
    },
  }

  return (
    <div className="ln-root wn-root">
      <Nav />

      <main>
        {/* ── Hero: plain-English answer ───────────────── */}
        <section className="wn-hero">
          <div className="ln-container">
            <span className="ln-kicker">The simple answer</span>
            <h1 className="wn-h1">What is Nodea?</h1>
            <p className="wn-lede">
              <strong>Nodea is a branching AI chat canvas.</strong> Every reply from
              the AI becomes a node you can fork from. Instead of one long thread
              that you keep scrolling, you get a tree — a visual map of every
              direction your conversation took, all kept side-by-side.
            </p>
            <p className="wn-lede wn-lede-sub">
              Think of it as ChatGPT, except every answer is a junction. Don&rsquo;t
              like a reply? Branch and ask again — the original stays exactly
              where it was.
            </p>

            <div className="wn-ctas">
              <Link href="/login?mode=signup" className="ln-btn ln-btn-primary ln-btn-lg">
                Open a canvas — free
              </Link>
              <Link href="/#features" className="ln-btn ln-btn-outline ln-btn-lg">
                See features
              </Link>
            </div>
          </div>
        </section>

        {/* ── TL;DR fact card ─────────────────────────── */}
        <section className="wn-tldr">
          <div className="ln-container">
            <div className="wn-tldr-card">
              <h2 className="wn-tldr-title">Nodea at a glance</h2>
              <ul className="wn-tldr-list">
                <li><strong>What it is:</strong> a tree-shaped chat interface for Claude.</li>
                <li><strong>Who it&rsquo;s for:</strong> people who think by exploring alternatives — writers, researchers, founders, engineers.</li>
                <li><strong>How it&rsquo;s priced:</strong> free in beta. Pro is $8/mo for Claude Opus and a doubled daily + 1M monthly token budget.</li>
                <li><strong>What powers it:</strong> Claude Haiku 4.5, Sonnet 4.6, and Opus 4.7, auto-routed by prompt complexity.</li>
                <li><strong>What you keep:</strong> every message you&rsquo;ve ever sent, every branch you&rsquo;ve ever explored, in one queryable tree.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Deep technical explanation ──────────────── */}
        <section className="wn-deep">
          <div className="ln-container wn-prose">
            <span className="ln-kicker">The technical answer</span>
            <h2 className="wn-h2">How Nodea actually works</h2>

            <p>
              The rest of this page is the long version — what Nodea looks like
              under the hood, how the tree is stored, how branches are computed,
              and the engineering decisions behind every node on the canvas. If
              you want to evaluate Nodea for your team, or you&rsquo;re a developer
              curious about the architecture, this is the page to read.
            </p>

            {/* Architecture */}
            <h3 className="wn-h3">1. Three-panel architecture</h3>
            <p>
              The Nodea app is a single Next.js route (<code>/app</code>) that
              renders three resizable panels:
            </p>
            <ul>
              <li>
                <strong>Sidebar</strong> — collapsible left panel (220&nbsp;px ↔ 54&nbsp;px)
                listing every conversation (&ldquo;project&rdquo;) the user has created. Search,
                new-project, and account controls live here.
              </li>
              <li>
                <strong>Chat panel</strong> — the linear view of the currently
                selected branch. New user messages stream a Claude response into
                this panel via Server-Sent Events.
              </li>
              <li>
                <strong>Tree panel</strong> — the canvas. A free pan-and-zoom
                XYFlow surface rendering the entire conversation as a directed
                tree. Clicking any node selects that branch and rewrites the
                chat panel to the path from root to that node.
              </li>
            </ul>
            <p>
              The panels share a React context (<code>AppContext</code>) that
              holds the current project, the selected node, the layout positions,
              and the streaming state. Layout is recomputed in pure JS whenever
              the tree changes — no layout engine, just a deterministic
              breadth-first walk that places parents above children with
              horizontal spread per subtree width.
            </p>

            {/* Data model */}
            <h3 className="wn-h3">2. The tree, stored as two tables</h3>
            <p>
              The branching structure lives in Postgres (Supabase) as two tables:
            </p>
            <pre className="wn-code">{`projects (
  id          uuid primary key,
  user_id     uuid references auth.users,
  name        text,
  created_at  timestamptz
)

nodes (
  id          uuid primary key,
  project_id  uuid references projects,
  parent_id   uuid references nodes,   -- null = root
  role        text check (role in ('user','assistant')),
  content     text,
  position_x  real,
  position_y  real,
  created_at  timestamptz
)`}</pre>
            <p>
              That&rsquo;s it. A conversation is a project. Every message — user
              or assistant — is a node with a single <code>parent_id</code>.
              Branching is just inserting a new node whose <code>parent_id</code>{' '}
              points to some existing node. The chat panel for a given selected
              node is the chain you get by walking <code>parent_id</code> back to
              null.
            </p>
            <p>
              Row-level security policies (<code>auth.uid() = user_id</code>)
              ensure a user can only read and write their own projects and nodes.
            </p>

            {/* Branching */}
            <h3 className="wn-h3">3. What &ldquo;branching&rdquo; actually means</h3>
            <p>
              In linear chat (ChatGPT, Claude.ai), the conversation is a list.
              Each new message is appended; if you want a different answer to an
              earlier question, you either rewind (destroying history) or open a
              new chat (losing context).
            </p>
            <p>
              In Nodea, the conversation is a directed acyclic tree. The system
              prompt and message history sent to Claude on each turn is{' '}
              <em>the path from root to the currently selected node</em>, not the
              entire project. Clicking a different node re-selects a different
              path and rebuilds the prompt accordingly. Every branch is
              completely independent — no &ldquo;memory&rdquo; from a sibling branch
              bleeds in.
            </p>
            <p>
              This is what makes Nodea useful for non-linear thinking: comparing
              two different framings of the same question, A/B testing prompts,
              or exploring three different plans from the same starting point
              without losing any of them.
            </p>

            {/* Model routing */}
            <h3 className="wn-h3">4. Model routing</h3>
            <p>
              Nodea uses three Claude models via the Vercel AI SDK and the
              Anthropic provider:
            </p>
            <ul>
              <li>
                <code>claude-haiku-4-5-20251001</code> — fastest, lowest cost,
                used by default on free plans for short / simple prompts.
              </li>
              <li>
                <code>claude-sonnet-4-6</code> — balanced reasoning quality,
                supports web search, used for complex prompts on free plans and
                default on Pro.
              </li>
              <li>
                <code>claude-opus-4-7</code> — heaviest reasoning, Pro-only,
                automatically selected for complex prompts.
              </li>
            </ul>
            <p>
              The routing rule is intentionally simple: if the user&rsquo;s last
              message is longer than 100 words or matches a regex of
              reasoning-heavy verbs (<em>analyze, compare, refactor, explain,
              design,</em> &hellip;), it&rsquo;s &ldquo;complex&rdquo; and upgrades a tier. Otherwise
              it stays at the cheaper tier. Pro users skip Haiku entirely.
            </p>

            {/* Streaming */}
            <h3 className="wn-h3">5. Streaming and token accounting</h3>
            <p>
              The chat endpoint (<code>/api/chat</code>) is a streaming POST that
              calls <code>streamText</code> from the Vercel AI SDK. Tokens are
              estimated up front (using a 4&nbsp;chars-per-token approximation), checked
              against the user&rsquo;s daily budget, and the actual usage is recorded
              after the stream completes — so a runaway response can&rsquo;t silently
              drain a quota past the cap.
            </p>
            <p>
              Daily limits are enforced in Postgres via a{' '}
              <code>daily_token_usage</code> table keyed on{' '}
              <code>(user_id, date)</code>. Admin users (flagged via{' '}
              <code>user_profiles.is_admin</code>) bypass limits. Plan tiers
              (<code>free</code>, <code>pro</code>) come from{' '}
              <code>user_profiles.plan</code>, which is written by the Stripe
              webhook on subscription create / update / cancel events.
            </p>

            {/* Search */}
            <h3 className="wn-h3">6. Search — keyword and semantic</h3>
            <p>
              The search modal supports two modes:
            </p>
            <ul>
              <li>
                <strong>Keyword search</strong> — live, client-side substring
                match across project names and node content. Instant; no network
                round-trip.
              </li>
              <li>
                <strong>Concept search</strong> — sends the query plus a
                compacted index of the user&rsquo;s nodes to Claude (Haiku for free,
                Sonnet for Pro) and asks it to return the most semantically
                relevant matches with reasoning. Slower, network-dependent, but
                finds &ldquo;the conversation where I was thinking about pricing&rdquo; even
                if you never used the word &ldquo;pricing.&rdquo;
              </li>
            </ul>

            {/* Auth */}
            <h3 className="wn-h3">7. Authentication and anonymous mode</h3>
            <p>
              Auth runs entirely through Supabase. Two flows are supported:
            </p>
            <ul>
              <li>
                <strong>Email + password</strong> — standard sign-up with email
                verification and a password-reset flow at{' '}
                <code>/login/update-password</code>.
              </li>
              <li>
                <strong>Anonymous sign-in</strong> — Supabase&rsquo;s anonymous user
                feature creates a real <code>auth.users</code> row without
                requiring an email. Anonymous users can chat, branch, and save
                projects exactly like signed-up users. They can later &ldquo;claim&rdquo;
                their data by linking an email — no data migration required.
              </li>
            </ul>

            {/* Privacy */}
            <h3 className="wn-h3">8. Privacy and data flow</h3>
            <p>
              Nodea sends only the path from root to the selected node to Claude
              on each turn — never the entire tree, never sibling branches. The
              user&rsquo;s data lives in their own Supabase row, isolated by RLS.
              Anthropic&rsquo;s API terms prohibit training on the data sent through
              their commercial endpoints, so nothing you write in a Nodea
              conversation enters a model training set.
            </p>
            <p>
              Anonymous analytics (page views, session duration, custom events)
              are captured via Vercel Analytics plus a self-hosted{' '}
              <code>page_views</code> table for the admin dashboard. No
              third-party trackers, no ads, no cross-site identifiers.
            </p>

            {/* Stack table */}
            <h3 className="wn-h3">9. The full stack</h3>
            <div className="wn-stack-table">
              <div className="wn-stack-row wn-stack-head">
                <span>Layer</span>
                <span>Technology</span>
                <span>Why</span>
              </div>
              {STACK.map((s) => (
                <div key={s.layer} className="wn-stack-row">
                  <span className="wn-stack-layer">{s.layer}</span>
                  <span className="wn-stack-tech">{s.tech}</span>
                  <span className="wn-stack-note">{s.note}</span>
                </div>
              ))}
            </div>

            {/* Design philosophy */}
            <h3 className="wn-h3">10. Design philosophy</h3>
            <p>
              Three principles shape every product decision:
            </p>
            <ul>
              <li>
                <strong>Branching is a thinking pattern, not a feature.</strong>{' '}
                The tree isn&rsquo;t a sidebar on top of a chat — it&rsquo;s the data model.
                Everything else (the chat panel, the sidebar) is just a view
                onto the tree.
              </li>
              <li>
                <strong>Friction kills exploration.</strong> Anonymous sign-in,
                no credit card, no waitlist. If you have to think about whether
                opening a canvas is &ldquo;worth it,&rdquo; you&rsquo;ll never see the second
                branch.
              </li>
              <li>
                <strong>The user&rsquo;s data is theirs.</strong> Two-table schema,
                exportable, isolated by RLS. No vendor lock-in beyond Claude
                itself.
              </li>
            </ul>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────── */}
        <section className="wn-faq">
          <div className="ln-container wn-prose">
            <span className="ln-kicker">FAQ</span>
            <h2 className="wn-h2">Frequently asked questions</h2>
            <div className="wn-faq-list">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="wn-faq-item">
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────── */}
        <section className="wn-cta">
          <div className="ln-container">
            <h2 className="wn-h2 wn-cta-h2">Ready to think in branches?</h2>
            <p className="wn-cta-sub">Free during beta. No credit card. No waitlist.</p>
            <div className="wn-ctas">
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableJsonLd) }}
      />
    </div>
  )
}
