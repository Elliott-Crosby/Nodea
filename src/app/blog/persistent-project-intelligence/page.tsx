import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import '../blog.css'
import { getPost } from '../posts'

const SLUG = 'persistent-project-intelligence'
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
  },
  twitter: {
    card: 'summary_large_image',
    title: post.title,
    description: post.description,
  },
}

export default function PersistentProjectIntelligencePost() {
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
                <li><a href="#the-problem">The problem: every chat starts from zero</a></li>
                <li><a href="#what-pi-means">What &ldquo;project intelligence&rdquo; actually means</a></li>
                <li><a href="#three-layers">The three layers of persistent context</a></li>
                <li><a href="#workflow">A workflow for long-running AI projects</a></li>
                <li><a href="#root-node">The root node as project charter</a></li>
                <li><a href="#maintenance">How to maintain a project without it bloating</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ol>
            </nav>

            <p>
              Knowledge workers don&rsquo;t do one-shot tasks. They do projects —
              work that spans weeks, involves a recurring set of constraints,
              and accumulates decisions that have to be remembered the next
              time the work is touched. The work-and-the-context belong
              together.
            </p>
            <p>
              Mainstream AI chat tools assume the opposite. Each session is a
              clean slate. Whatever context you negotiated last Thursday is
              gone Monday morning unless you saved it out by hand. That gap
              between &ldquo;how I actually work on projects&rdquo; and
              &ldquo;how AI chat lets me work&rdquo; is where most of the
              productivity promise quietly leaks out.
            </p>

            <h2 id="the-problem">The problem: every chat starts from zero</h2>
            <p>
              Here is the typical lifecycle of a serious AI conversation
              today:
            </p>
            <ol>
              <li>
                You open a new chat. You spend the first three or four
                messages bringing the model up to speed — your goals, your
                constraints, your preferences, the relevant background.
              </li>
              <li>
                The conversation does useful work. The model now knows things
                that took effort to convey.
              </li>
              <li>
                You close the tab, or the thread gets too long, or the model
                hits a context limit, or it&rsquo;s just been a few days.
              </li>
              <li>
                Next time, you start a new chat. Go to step 1.
              </li>
            </ol>
            <p>
              The hidden tax is enormous. Every &ldquo;new chat&rdquo; is
              another round of onboarding. The model that finally understood
              your design system or your codebase or your writing voice no
              longer does. You either retype that context (boring, lossy)
              or accept generic answers that don&rsquo;t reflect what you
              already established.
            </p>
            <p>
              ChatGPT &ldquo;memory,&rdquo; Claude Projects, and similar
              features help — but partially. They store retrievable facts
              about you, not the structured working context of a specific
              project. They&rsquo;re closer to a profile than a workspace.
            </p>

            <h2 id="what-pi-means">What &ldquo;project intelligence&rdquo; actually means</h2>
            <p>
              We use &ldquo;persistent project intelligence&rdquo; to mean
              something specific: a structured, durable, navigable record of
              everything the AI needs to know to help you on a particular
              project — that you can return to next week and pick up where
              you left off, with the model still operating from the same
              shared context.
            </p>
            <p>
              The key word is <em>structured</em>. A wall of saved chat
              history isn&rsquo;t intelligence; it&rsquo;s archaeology. Project
              intelligence has three properties:
            </p>
            <ul>
              <li>
                <strong>Addressable.</strong> You can point at a specific
                decision or constraint and say &ldquo;continue from
                here.&rdquo; You aren&rsquo;t scrolling — you&rsquo;re
                navigating.
              </li>
              <li>
                <strong>Composable.</strong> You can combine pieces of past
                context selectively. The model gets exactly the relevant
                history for the question at hand, not everything you&rsquo;ve
                ever discussed.
              </li>
              <li>
                <strong>Durable.</strong> Context survives the session. You
                close the tab, come back in two weeks, and the structure is
                still there waiting.
              </li>
            </ul>

            <h2 id="three-layers">The three layers of persistent context</h2>
            <p>
              Practical project intelligence is layered. Different kinds of
              context belong in different places and should be invoked
              differently.
            </p>

            <h3>Layer 1: The charter (rarely changes)</h3>
            <p>
              The high-level goal of the project, the audience, the
              constraints, the explicit non-goals. This is the stuff you
              wrote down once and probably won&rsquo;t rewrite. In Nodea, this
              lives in the root node of a project — the message that every
              branch ultimately descends from. Whatever model you talk to
              in any branch is operating with this context implicitly.
            </p>

            <h3>Layer 2: Established decisions (changes slowly)</h3>
            <p>
              Decisions you&rsquo;ve made during the project: the architecture
              choice, the brand voice rules, the names you settled on, the
              hypotheses you ruled out. These are reference material. You
              consult them; you rarely overturn them. In a branching
              workspace, these are mid-tree nodes that you mark or pin —
              the &ldquo;here&rsquo;s what we decided&rdquo; nodes that anchor
              future work.
            </p>

            <h3>Layer 3: Live exploration (changes constantly)</h3>
            <p>
              The current question you&rsquo;re working on. This is the leaf of
              the tree — the active branch where you&rsquo;re generating drafts,
              testing variants, working through a problem. Most of your
              session is spent here.
            </p>
            <p>
              The reason this layering matters: in a linear chat, all three
              are mixed together in the same scroll. The model can&rsquo;t
              easily tell what&rsquo;s settled and what&rsquo;s being explored —
              and neither can you, two weeks later. In a tree, the layers
              are spatially separated. The charter is the root, the
              decisions are the named internal nodes, the exploration is
              the leaves.
            </p>

            <h2 id="workflow">A workflow for long-running AI projects</h2>
            <p>
              Here&rsquo;s a concrete workflow that turns AI chat from a
              one-shot tool into a persistent project workspace.
            </p>

            <h3>Step 1: Open a project, not a chat</h3>
            <p>
              The first move is not to ask a question. It&rsquo;s to write the
              project charter as the root message. Three to six sentences:
              what you&rsquo;re trying to accomplish, who it&rsquo;s for, what the
              non-negotiable constraints are, and what success looks like.
              This becomes the implicit context for every branch.
            </p>
            <p>
              In Nodea, a project is a distinct database object — your
              branches all share the same root and the same identity.
              Returning to the project a week later loads the entire tree.
            </p>

            <h3>Step 2: Branch first, ask second</h3>
            <p>
              For each substantive question, branch from the most relevant
              prior node. Don&rsquo;t pile everything into one trunk. A
              workflow question is one branch. A draft is one branch. A
              comparison of two options is two parallel branches.
            </p>
            <p>
              This isn&rsquo;t organization theater — it&rsquo;s context hygiene.
              Each branch sends the model a focused, relevant subset of
              history, not everything you&rsquo;ve ever said on the project.
              Answers get sharper because the context gets tighter.
            </p>

            <h3>Step 3: Promote decisions explicitly</h3>
            <p>
              When the AI helps you settle something — &ldquo;we&rsquo;re using
              Postgres, not Mongo,&rdquo; &ldquo;the brand voice avoids
              exclamation points,&rdquo; &ldquo;the audience is technical
              founders, not engineers&rdquo; — name that node. Rename the
              branch, pin it, or add a quick summary message. The point is
              to make settled decisions visually distinct from open
              exploration.
            </p>
            <p>
              A week from now, you should be able to glance at the tree and
              identify the &ldquo;here&rsquo;s what we decided&rdquo; nodes
              without reading the whole thing.
            </p>

            <h3>Step 4: Re-enter at the right node</h3>
            <p>
              When you come back to a project, the move is not to start a
              new chat. It&rsquo;s to find the node closest to what you&rsquo;re
              about to work on and branch from there. The model picks up
              with full local context — without needing the entire project
              history.
            </p>

            <div className="bl-cta-inline">
              <h3>Give your projects somewhere to live.</h3>
              <p>
                Nodea organizes Claude conversations as branching projects —
                root context, named decisions, live branches, all in one
                durable canvas.
              </p>
              <Link href="/login?mode=signup" className="ln-btn ln-btn-primary">
                Try Nodea free →
              </Link>
            </div>

            <h2 id="root-node">The root node as project charter</h2>
            <p>
              The single highest-leverage move you can make on a long-running
              AI project is to take the root node seriously. Most people
              type a casual question into a fresh chat and never explicitly
              set context. That&rsquo;s a defensible choice for one-shot
              tasks; it&rsquo;s the wrong choice for projects you&rsquo;ll return
              to.
            </p>
            <p>
              A good root node looks like this:
            </p>
            <pre><code>{`Project: redesigning the dashboard for [product]

Audience: existing customers, mostly technical, who use the dashboard
3-5x/week. They know our product but find the current dashboard cluttered.

Goal: a redesign that surfaces the 3 metrics that matter (defined as MAU,
churn, and NPS) and demotes everything else to secondary views.

Non-goals: changing the underlying data model, adding new metrics, or
re-platforming. This is a layout and information-hierarchy project only.

Constraints: must work on screens >=1280px wide, must support dark mode,
must remain accessible (WCAG AA), and must ship in ~3 weeks.

Voice: when writing copy, keep it terse and concrete. No marketing tone,
no exclamation points, no second-person pep talk.`}</code></pre>
            <p>
              Every branch you start from this root inherits this context
              implicitly. The model doesn&rsquo;t need to be told the audience
              again. It knows the voice rules. It knows the constraints.
              You&rsquo;ve done the onboarding once — for the whole project.
            </p>

            <h2 id="maintenance">How to maintain a project without it bloating</h2>
            <p>
              The natural worry: doesn&rsquo;t a project tree become an
              unmanageable mess after a few weeks?
            </p>
            <p>
              In practice, well-tended trees stay small — typically twenty
              to fifty meaningful nodes for a multi-week project. The
              reason is that most exploration is short-lived and most
              branches die naturally once they&rsquo;ve served their purpose.
              The maintenance discipline is simple:
            </p>
            <ul>
              <li>
                <strong>Prune at the end of each session.</strong> Delete
                exploratory branches that didn&rsquo;t lead anywhere. The
                point of a dead branch was to find out it was dead — once
                you know, the node has done its job.
              </li>
              <li>
                <strong>Promote what mattered.</strong> When a branch
                settled a question, name it (&ldquo;decided: Postgres&rdquo;)
                so the structural meaning is visible.
              </li>
              <li>
                <strong>Snapshot the canonical path.</strong> The
                root-to-current-leaf path of the &ldquo;main&rdquo; work is
                effectively the live state of the project. Keep it tidy.
              </li>
              <li>
                <strong>Don&rsquo;t over-organize.</strong> The canvas isn&rsquo;t
                meant to be a curated artifact — it&rsquo;s a working
                surface. Tolerate some mess. Trim only the parts that get
                in the way of finding things next time.
              </li>
            </ul>

            <h2 id="faq">FAQ</h2>

            <h3>How is this different from ChatGPT Projects or Claude Projects?</h3>
            <p>
              Both let you group chats by topic and share files across them.
              Useful, but each chat inside the project is still linear.
              Persistent project intelligence is about the structure
              <em> within</em> a long conversation — the branching tree,
              the addressable decisions, the layered context — not just
              sharing files across separate threads. You can think of
              Nodea&rsquo;s projects as one level deeper than Projects in
              other tools.
            </p>

            <h3>What happens when the project gets too big for the model&rsquo;s context window?</h3>
            <p>
              Because Nodea only sends the path from root to the current
              node — not the entire tree — most projects stay well under
              context limits for a long time. Branches that are not on the
              current path don&rsquo;t cost anything. If a single path does
              grow too long, you can branch from an earlier node and
              continue from there, effectively trimming the trailing
              context.
            </p>

            <h3>Can I share a project tree with a teammate?</h3>
            <p>
              Sharing is on the near-term roadmap. The architecture
              supports it — the tree is just rows in Postgres — but the
              first release of Nodea is focused on individual workflows.
              For now, the most common pattern is to export specific
              branches as text for handoff.
            </p>

            <h3>What if the model changes (Sonnet 4.6 → Sonnet 4.7, etc.)?</h3>
            <p>
              Your project tree is independent of the model. Each branch
              records which model generated each reply, and you can
              continue any branch with a different model later. Context
              comes from the conversation structure, not from the model&rsquo;s
              internal memory — so a model upgrade doesn&rsquo;t erase your
              project.
            </p>

            <h3>How long should I expect a serious project to live in this format?</h3>
            <p>
              The pattern works best on projects measured in weeks to a few
              months. Past that, the natural unit gets bigger — you might
              spin off multiple related projects as separate trees, sharing
              charters between them. For multi-quarter work, treat each
              tree as one stage of a larger effort.
            </p>

            <p>
              For background on the branching model itself, see the{' '}
              <Link href="/blog/branching-ai-chat-guide">complete guide to
              branching AI chat</Link>. For the everyday case of not losing
              individual ideas, see{' '}
              <Link href="/blog/never-lose-thinking">never lose a train of
              thought again</Link>.
            </p>
          </div>
        </div>

        <section className="bl-article-end-cta">
          <div className="ln-container">
            <h2>Your projects deserve more than a chat scroll.</h2>
            <p>Open a Nodea canvas and give your work a place to compound.</p>
            <Link href="/login?mode=signup" className="ln-btn ln-btn-primary ln-btn-lg">
              Open my first canvas
            </Link>
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
    </div>
  )
}
