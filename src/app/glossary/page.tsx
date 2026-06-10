import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import './glossary.css'
import { OG_IMAGES, TWITTER_IMAGES } from '@/lib/og'

export const metadata: Metadata = {
  title: 'Glossary — Branching AI Chat Terminology',
  description:
    'Plain-English definitions of branching AI chat terminology: nodes, branches, forks, canvases, tree-of-thought, linear chat, and how the concepts fit together.',
  alternates: { canonical: '/glossary' },
  openGraph: {
    title: 'Branching AI Chat Glossary — Nodea',
    description:
      'Definitions of branching AI chat terminology: nodes, branches, forks, canvases, tree-of-thought, and more.',
    url: 'https://nodea.ai/glossary',
    type: 'article',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Branching AI Chat Glossary',
    description: 'Plain-English definitions of branching AI chat terminology.',
    images: TWITTER_IMAGES,
  },
}

interface Term {
  id: string
  name: string
  short: string
  long: string
  alsoKnownAs?: string[]
}

const TERMS: Term[] = [
  {
    id: 'branching-ai-chat',
    name: 'Branching AI chat',
    short: 'A conversation interface where each message is a node in a tree, and any node can spawn a new branch.',
    long: 'In a branching AI chat, the conversation is stored as a directed tree of messages instead of a flat list. From any reply, the user can fork a new branch — a divergent path that explores an alternative response without overwriting or losing the original. The current "chat view" is the path from the root of the tree to the currently selected node.',
    alsoKnownAs: ['non-linear chat', 'tree-shaped chat', 'forking chat'],
  },
  {
    id: 'linear-chat',
    name: 'Linear chat',
    short: 'A conversation interface where messages are appended to a single ordered list, with no first-class branching.',
    long: 'Linear chat is the default shape for products like ChatGPT and Claude.ai. To explore an alternative, the user must either edit a prior message (destroying the original) or start a new conversation (losing all prior context). There is no first-class "branch" operation.',
    alsoKnownAs: ['thread-based chat', 'linear thread'],
  },
  {
    id: 'node',
    name: 'Node',
    short: 'A single message in a branching conversation, with a parent and zero or more children.',
    long: 'A node represents one message — from either the user or the AI — in the conversation tree. Each node has exactly one parent (or null if it is the root) and any number of children. In Nodea, nodes live in the Postgres `nodes` table with columns for role, content, parent_id, and position coordinates for canvas layout.',
  },
  {
    id: 'branch',
    name: 'Branch',
    short: 'A divergent path from a node, created by attaching a new child to an existing message.',
    long: 'A branch is born the moment a node has more than one child. From that point, the original child remains and a new child (a new question or a regenerated answer) is attached alongside it. Each branch is independent — only the path from root to the currently selected node is sent to the AI on the next turn, so sibling branches never bleed into each other.',
    alsoKnownAs: ['fork', 'alternative path'],
  },
  {
    id: 'fork',
    name: 'Fork (a conversation)',
    short: 'The action of creating a new branch from an existing node — the verb form of "branch."',
    long: 'To fork a conversation is to pick a node and attach a new child to it, opening a parallel exploration. In Nodea, forking is a one-click action on any message. In linear chat tools, forking is approximated by editing a previous message or by opening a new conversation and re-pasting context — both lossy workarounds.',
  },
  {
    id: 'canvas',
    name: 'Canvas',
    short: 'A pan-and-zoom visual surface that renders the entire conversation tree as a graph.',
    long: 'The canvas is the visual representation of the conversation tree. Each node is drawn as a card, parent-child relationships are drawn as edges, and the user can pan, zoom, and click any node to instantly switch the chat view to that branch. In Nodea, the canvas is built on XYFlow (React Flow) over a deterministic breadth-first layout.',
  },
  {
    id: 'tree-of-thought',
    name: 'Tree of thought (ToT)',
    short: 'A prompting and reasoning pattern where a model explores multiple alternative continuations and selects among them.',
    long: 'Tree of thought, introduced in a 2023 research paper, is a prompting technique that improves on chain-of-thought by having the model generate several candidate next steps, evaluate them, and continue with the most promising. A branching chat interface is the natural human-facing analogue: instead of one linear chain of reasoning, the user explores multiple branches and keeps the best paths.',
    alsoKnownAs: ['ToT', 'tree-of-thoughts'],
  },
  {
    id: 'path',
    name: 'Path (in a conversation tree)',
    short: 'The ordered chain of nodes from the root of the tree down to a selected node.',
    long: 'A path is what gets sent to the AI model on each turn. In Nodea, when the user selects a node, the system walks the tree backwards from that node to the root, collects every message along the way, and sends that ordered sequence as the conversation history. Sibling branches are never included — each path is independent.',
  },
  {
    id: 'project',
    name: 'Project',
    short: 'A single top-level conversation tree — a discrete topic or workspace.',
    long: 'In Nodea, a project is one conversation tree: one root node and everything that branches from it. A user has many projects, listed in the sidebar. Projects are stored in the `projects` table and their nodes are stored in the `nodes` table, linked by `project_id`.',
    alsoKnownAs: ['conversation', 'chat tree'],
  },
  {
    id: 'streaming',
    name: 'Streaming (AI response)',
    short: 'The pattern of delivering a model’s output token-by-token as it is generated, instead of waiting for the full response.',
    long: 'Streaming uses HTTP server-sent events (or similar) to push each token to the client as soon as the model produces it. This makes long responses feel responsive. In Nodea, streaming is implemented via the Vercel AI SDK’s `streamText` function over the Anthropic provider.',
  },
  {
    id: 'model-routing',
    name: 'Model routing',
    short: 'Automatically choosing which underlying AI model to call for a given prompt, based on complexity and plan tier.',
    long: 'Model routing trades off cost, latency, and capability per request. In Nodea, simple short prompts go to Claude Haiku 4.5 (fast, cheap); reasoning-heavy or longer prompts upgrade to Sonnet 4.6; and Pro users’ hardest prompts go to Opus 4.7. The routing rule looks at message length and a regex of reasoning verbs like "analyze," "compare," and "design."',
  },
  {
    id: 'anonymous-signin',
    name: 'Anonymous sign-in',
    short: 'A real user account created without requiring an email address, claimable later by linking credentials.',
    long: 'Anonymous sign-in (a Supabase feature Nodea uses) creates a row in `auth.users` with no email — the user gets a stable identity and can save data, but never had to commit a real email. Later, the same user can "link" credentials (email + password, OAuth) and the data carries over without migration.',
  },
]

export default function GlossaryPage() {
  const definedTermSetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': 'https://nodea.ai/glossary#set',
    name: 'Branching AI Chat Glossary',
    description:
      'Plain-English definitions of branching AI chat terminology: nodes, branches, forks, canvases, tree-of-thought, and more.',
    url: 'https://nodea.ai/glossary',
    hasDefinedTerm: TERMS.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `https://nodea.ai/glossary#${t.id}`,
      name: t.name,
      description: t.long,
      url: `https://nodea.ai/glossary#${t.id}`,
      inDefinedTermSet: 'https://nodea.ai/glossary#set',
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nodea.ai/' },
      { '@type': 'ListItem', position: 2, name: 'Glossary', item: 'https://nodea.ai/glossary' },
    ],
  }

  return (
    <div className="ln-root gl-root">
      <Nav />
      <main>
        <section className="gl-hero">
          <div className="ln-container">
            <span className="ln-kicker">Glossary</span>
            <h1 className="gl-h1">Branching AI chat, defined.</h1>
            <p className="gl-lede">
              A plain-English glossary of the terms that show up across the Nodea
              app, the blog, and the rest of the branching-AI ecosystem.
              Bookmark it, link it, copy from it.
            </p>

            <nav className="gl-toc" aria-label="Terms in this glossary">
              {TERMS.map((t) => (
                <a key={t.id} href={`#${t.id}`}>{t.name}</a>
              ))}
            </nav>
          </div>
        </section>

        <section className="gl-terms">
          <div className="ln-container">
            <dl className="gl-list">
              {TERMS.map((t) => (
                <div key={t.id} id={t.id} className="gl-item">
                  <dt className="gl-term">
                    <h2 className="gl-term-name">{t.name}</h2>
                    {t.alsoKnownAs && t.alsoKnownAs.length > 0 && (
                      <p className="gl-aka">
                        Also known as: {t.alsoKnownAs.join(', ')}
                      </p>
                    )}
                  </dt>
                  <dd className="gl-def">
                    <p className="gl-short"><strong>{t.short}</strong></p>
                    <p className="gl-long">{t.long}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="gl-cta">
          <div className="ln-container">
            <h2>See the canvas behind the words.</h2>
            <p>Open a Nodea canvas — free, no credit card.</p>
            <Link href="/login?mode=signup" className="ln-btn ln-btn-primary ln-btn-lg">
              Try Nodea
            </Link>
          </div>
        </section>
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSetJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </div>
  )
}
