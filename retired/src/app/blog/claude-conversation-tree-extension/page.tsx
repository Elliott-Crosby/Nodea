import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import '../blog.css'
import { getPost } from '../posts'
import { OG_IMAGES, TWITTER_IMAGES } from '@/lib/og'
import { CHROME_STORE_URL } from '@/lib/links'

const SLUG = 'claude-conversation-tree-extension'
const post = getPost(SLUG)!

export const metadata: Metadata = {
  title: { absolute: post.title },
  description: post.description,
  alternates: { canonical: `/blog/${SLUG}` },
  keywords: post.keywords,
  openGraph: {
    title: post.title,
    description: post.description,
    url: `https://nodea.ai/blog/${SLUG}`,
    type: 'article',
    publishedTime: post.publishedAt,
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: post.title,
    description: post.description,
    images: TWITTER_IMAGES,
  },
}

export default function ClaudeConversationTreePost() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    image: 'https://nodea.ai/og/primary.png',
    description: post.description,
    author: { '@type': 'Organization', name: 'Nodea' },
    publisher: { '@type': 'Organization', name: 'Nodea', url: 'https://nodea.ai' },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    mainEntityOfPage: `https://nodea.ai/blog/${SLUG}`,
    keywords: post.keywords.join(', '),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nodea.ai/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://nodea.ai/blog' },
      { '@type': 'ListItem', position: 3, name: post.title, item: `https://nodea.ai/blog/${SLUG}` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Does Claude.ai have a conversation tree view?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Not a visible one. Claude.ai stores the branches you create by editing or regenerating a message, but it only exposes them through small previous/next arrows. There is no map of the whole tree. The Nodea Tree for Claude extension reconstructs that hidden tree and draws it beside your chat.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is the Nodea Tree for Claude extension free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The extension is free on the Chrome Web Store. It reads your own open Claude.ai conversation through your existing login and draws its branch tree. Importing into the full Nodea canvas is also free to start.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is it safe — does it send my Claude conversations anywhere?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The extension reads your currently open conversation through your own Claude login, read-only, and renders the tree locally in your browser. No conversation text leaves your machine unless you explicitly click to import it into your Nodea account. It is not affiliated with Anthropic.',
        },
      },
    ],
  }

  return (
    <div className="ln-root bl-root">
      <Nav />
      <article>
        <header className="bl-article-hero">
          <div className="ln-container">
            <div className="bl-article-meta">
              <span className="bl-pill">{post.category}</span>
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </time>
              <span>·</span>
              <span>{post.readMinutes} min read</span>
            </div>
            <h1 className="bl-article-h1">{post.title}</h1>
            <p className="bl-article-desc">{post.description}</p>
          </div>
        </header>

        <div className="ln-container">
          <div className="bl-article-body">
            <nav className="bl-toc" aria-label="Table of contents">
              <p className="bl-toc-title">Contents</p>
              <ol>
                <li><a href="#hidden-tree">The tree hiding inside every Claude conversation</a></li>
                <li><a href="#why-invisible">Why you can&rsquo;t see it in Claude.ai</a></li>
                <li><a href="#what-extension-shows">What the extension draws beside your chat</a></li>
                <li><a href="#from-viewing-to-working">From viewing a tree to working in one</a></li>
                <li><a href="#install">How to install it</a></li>
                <li><a href="#privacy">Is it safe? What it can and can&rsquo;t see</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ol>
            </nav>

            <p>
              Every time you edit a prompt or regenerate a reply in Claude.ai, you create
              a branch. Claude keeps all of them &mdash; but it only ever shows you one
              path at a time, behind a pair of tiny <code>&lt;</code>&nbsp;/&nbsp;<code>&gt;</code>{' '}
              arrows that are easy to miss. The shape of your exploration is real, stored,
              and almost completely invisible.
            </p>
            <p>
              <strong>Nodea Tree for Claude</strong>{' '}is a free Chrome extension that
              reconstructs that hidden tree and draws it right beside your conversation
              &mdash; then, on one click, imports the whole thing into the{' '}
              <Link href="/what-is-nodea">Nodea canvas</Link> where you can actually fork,
              merge, and keep working.
            </p>

            <figure className="bl-figure">
              <img
                src="/media/nodea-ai-extension-claude-scaled.png"
                width={1920}
                height={1200}
                alt="A Claude.ai conversation with the Nodea Tree for Claude panel open beside it, showing the same chat rebuilt as a branching tree of nodes."
                loading="lazy"
              />
              <figcaption className="bl-figcaption">
                The extension docks beside Claude.ai and turns your flat thread into a
                visual branch tree &mdash; including the branches Claude hides.
              </figcaption>
            </figure>

            <div className="bl-cta-inline">
              <h3>Want to see your own Claude tree?</h3>
              <p>
                Install the free extension, open any Claude.ai chat you&rsquo;ve edited or
                regenerated, and watch its hidden branches appear.
              </p>
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ln-btn ln-btn-primary"
              >
                Add to Chrome — Free →
              </a>
            </div>

            <h2 id="hidden-tree">The tree hiding inside every Claude conversation</h2>
            <p>
              Under the hood, a Claude conversation isn&rsquo;t a list &mdash; it&rsquo;s a
              tree. Each message is a node, and a node can have more than one child. When
              you regenerate an answer, Claude adds a second child to the same parent.
              When you edit one of your own messages and resend, you create a second
              branch from that point. The version you&rsquo;re reading is just whichever
              path from the root to a leaf happens to be selected right now.
            </p>
            <p>
              That means most active Claude users are sitting on a sprawling tree of
              abandoned and alternative branches they&rsquo;ve never been able to see all
              at once. The good ideas you regenerated past are still in there. So are the
              tangents you backed out of.
            </p>

            <h2 id="why-invisible">Why you can&rsquo;t see it in Claude.ai</h2>
            <p>
              Claude.ai&rsquo;s interface is built to show one linear thread. The branch
              navigation is deliberately minimal: a small counter like
              {' '}<code>2 / 3</code>{' '} with arrows to step between siblings. It works
              for flipping between two regenerations of a single reply. It falls apart the
              moment your exploration has depth &mdash; branches off branches, three
              directions from one question, an edit you made twenty messages ago.
            </p>
            <p>
              There&rsquo;s no overview, no map, no way to ask &ldquo;what were all the
              directions I tried here?&rdquo; The information exists; the interface just
              never surfaces it. (We broke down the same problem, and the manual
              workarounds, in{' '}
              <Link href="/blog/fork-chatgpt-conversation">how to fork a ChatGPT or Claude conversation</Link>.)
            </p>

            <h2 id="what-extension-shows">What the extension draws beside your chat</h2>
            <p>
              Open a Claude.ai conversation with the extension installed and a panel docks
              alongside the chat. It reads the conversation through your own logged-in
              session, reconstructs the full branch tree from Claude&rsquo;s own edit and
              regeneration history, and renders it as a visual map:
            </p>
            <ul>
              <li>
                <strong>Every branch, visible at once.</strong>{' '}The whole shape of the
                conversation &mdash; not just the path you&rsquo;re currently on.
              </li>
              <li>
                <strong>Jump to any node.</strong>{' '}Click a branch in the tree to see where
                it sits in the conversation.
              </li>
              <li>
                <strong>Color-code paths.</strong>{' '}Mark the branches that matter so a big
                tree stays readable instead of becoming a wall of identical boxes.
              </li>
            </ul>

            <figure className="bl-figure">
              <img
                src="/media/nodea-ai-extension-node-colors.png"
                width={1920}
                height={1200}
                alt="A reconstructed Claude conversation tree with several branches color-coded to highlight the important paths."
                loading="lazy"
              />
              <figcaption className="bl-figcaption">
                Color a branch and the path you care about stops disappearing into the
                noise.
              </figcaption>
            </figure>

            <h2 id="from-viewing-to-working">From viewing a tree to working in one</h2>
            <p>
              Seeing the tree is the hook. The reason it matters is what comes next: a{' '}
              <strong>&ldquo;Open in Nodea&rdquo;</strong>{' '}button that imports the entire
              conversation &mdash; every branch &mdash; into your Nodea canvas as a real,
              editable tree. The viewer is read-only by nature; Nodea is where the tree
              becomes something you can think in.
            </p>
            <p>Once it&rsquo;s in Nodea, you can:</p>
            <ul>
              <li><strong>Fork from any node</strong> &mdash; user message or AI reply, no edit tricks.</li>
              <li><strong>Merge branches</strong>{' '}back into one node so the AI answers with all of that context combined.</li>
              <li><strong>Switch Claude models per branch</strong> &mdash; Haiku for fast passes, Opus for the heavy thinking.</li>
              <li><strong>Search everything</strong>{' '}across all your conversations, by keyword or meaning.</li>
            </ul>
            <p>
              See the full list of what the canvas adds on the{' '}
              <Link href="/extension">extension page</Link>.
            </p>

            <h2 id="install">How to install it</h2>
            <ol>
              <li>
                Open the{' '}
                <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
                  Nodea Tree for Claude
                </a>{' '}
                listing on the Chrome Web Store and click <strong>Add to Chrome</strong>.
              </li>
              <li>
                Go to <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">claude.ai</a>{' '}
                and open any conversation where you&rsquo;ve edited a prompt or regenerated
                a reply.
              </li>
              <li>
                The Nodea panel docks beside the chat and draws its branch tree. Click{' '}
                <strong>Open in Nodea</strong>{' '}to import it into your canvas.
              </li>
            </ol>

            <div className="bl-cta-inline">
              <h3>Turn your Claude history into a tree.</h3>
              <p>Free on the Chrome Web Store. Works on any claude.ai conversation.</p>
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ln-btn ln-btn-primary"
              >
                Add to Chrome — Free →
              </a>
            </div>

            <h2 id="privacy">Is it safe? What it can and can&rsquo;t see</h2>
            <p>
              The extension only works on <code>claude.ai</code>, and it reads the
              conversation you currently have open through <em>your own</em>{' '}logged-in
              session &mdash; the same way the page itself loads it. It&rsquo;s read-only:
              it reconstructs and displays the tree locally in your browser.
            </p>
            <p>
              No conversation text is sent to Nodea&rsquo;s servers unless you explicitly
              click to import a conversation into your account. The extension is not
              affiliated with Anthropic. If you never click &ldquo;Open in Nodea,&rdquo; it
              stays a pure local viewer.
            </p>

            <h2 id="faq">FAQ</h2>

            <h3>Does Claude.ai have a conversation tree or branch view?</h3>
            <p>
              Not a visible one. Claude stores the branches you create by editing or
              regenerating, but only exposes them through small previous/next arrows on a
              single message. There&rsquo;s no map of the whole tree &mdash; which is
              exactly the gap this extension fills.
            </p>

            <h3>Will it show branches in conversations I&rsquo;ve already had?</h3>
            <p>
              Yes. The tree is reconstructed from Claude&rsquo;s existing history, so
              open an old conversation you edited or regenerated and its branches appear.
              If a conversation was perfectly linear (no edits, no regenerations), the
              tree is simply a straight line &mdash; there were no branches to reveal.
            </p>

            <h3>Do I need a Nodea account to use the extension?</h3>
            <p>
              You can install it and view your Claude trees without one. You only need a
              (free) Nodea account when you want to click <strong>Open in Nodea</strong>{' '}
              and import a conversation into the canvas to fork and merge it.
            </p>

            <h3>Does it work in browsers other than Chrome?</h3>
            <p>
              It&rsquo;s published on the Chrome Web Store, so it works in Chrome and
              Chromium-based browsers (Edge, Brave, Arc) that can install Chrome Web Store
              extensions.
            </p>

            <h3>What&rsquo;s the difference between the extension and the Nodea app?</h3>
            <p>
              The extension <em>captures and shows</em>{' '}the tree hidden in a Claude.ai
              chat. The <Link href="/what-is-nodea">Nodea app</Link>{' '}
              is where that tree
              becomes editable &mdash; forking, merging, sticky notes, color, search, and
              cross-chat memory. The <Link href="/extension">extension page</Link> lists
              everything the full canvas adds.
            </p>
          </div>
        </div>

        <section className="bl-article-end-cta">
          <div className="ln-container">
            <h2>Your Claude conversations are already trees. See them.</h2>
            <p>Install the free extension and turn your next chat into a map.</p>
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ln-btn ln-btn-primary ln-btn-lg"
            >
              Add to Chrome — Free
            </a>
          </div>
        </section>
      </article>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  )
}
