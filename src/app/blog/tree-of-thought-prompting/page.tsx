import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'
import '../blog.css'
import { getPost } from '../posts'

const SLUG = 'tree-of-thought-prompting'
const post = getPost(SLUG)!

export const metadata: Metadata = {
  title: post.title,
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

export default function TreeOfThoughtPost() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
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
                <li><a href="#what-is-tot">What is Tree of Thought prompting?</a></li>
                <li><a href="#cot-vs-tot">Chain of Thought vs Tree of Thought</a></li>
                <li><a href="#when-tot-wins">When ToT outperforms standard prompting</a></li>
                <li><a href="#how-to-apply">How to apply Tree of Thought manually</a></li>
                <li><a href="#the-interface-problem">The interface problem</a></li>
                <li><a href="#tot-plus-branching">Tree of Thought + a branching interface</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ol>
            </nav>

            <p>
              Chain of Thought asks the model to think step by step. It&rsquo;s been the
              dominant prompting technique since 2022 and it works — for problems that
              have a single best path. For problems where the first path might be the
              wrong one, it has a blind spot: it commits too early.
            </p>
            <p>
              Tree of Thought (ToT) fixes that. Instead of one chain of reasoning,
              the model explores multiple branches simultaneously, evaluates them, and
              backtracks when a branch is unproductive. The improvement on hard reasoning
              tasks can be dramatic. But most people don&rsquo;t use it — partly because it&rsquo;s
              more complex to set up, and partly because the standard chat interface is
              the wrong shape for it.
            </p>

            <h2 id="what-is-tot">What is Tree of Thought prompting?</h2>
            <p>
              Tree of Thought is a prompting framework introduced in a 2023 paper by
              Yao et al. The core idea: instead of generating a single chain of reasoning
              steps, prompt the model to generate multiple intermediate &ldquo;thoughts&rdquo; at
              each step, evaluate which are most promising, and continue only the
              promising ones. Unproductive paths are pruned. The search space explored
              is a tree, not a line.
            </p>
            <p>
              The model acts as both the generator (coming up with candidate thoughts)
              and the evaluator (judging which are worth pursuing). A third role —
              the search controller — decides when to go deeper, when to backtrack, and
              when to stop. Depending on implementation, the search controller can be
              the model itself, an external script, or the human.
            </p>
            <p>
              In practice, &ldquo;Tree of Thought&rdquo; is used loosely to describe any prompting
              approach that has the model consider multiple reasoning paths rather than
              committing to one. The strict academic version uses explicit search
              algorithms (BFS, DFS); the practical version often just asks the model to
              brainstorm candidates, evaluate them, and pick the best.
            </p>

            <h2 id="cot-vs-tot">Chain of Thought vs Tree of Thought</h2>
            <p>
              The difference isn&rsquo;t complexity — it&rsquo;s structure.
            </p>
            <p>
              <strong>Chain of Thought (CoT)</strong> asks the model to reason
              linearly: step 1, step 2, step 3, answer. It surfaces the reasoning so
              you can see where it went. The model commits to each step before generating
              the next. If step 2 is subtly wrong, the rest of the chain propagates that
              error forward.
            </p>
            <p>
              <strong>Tree of Thought (ToT)</strong> asks the model to hold multiple
              partial solutions open simultaneously: &ldquo;generate three possible next steps,
              evaluate each, continue the most promising.&rdquo; The model can backtrack if
              an approach dead-ends. This is closer to how humans actually solve hard
              problems — we don&rsquo;t commit fully to the first approach we think of.
            </p>

            <blockquote>
              CoT is the model narrating a single path. ToT is the model exploring a
              map and choosing a route.
            </blockquote>

            <p>
              The tradeoff: ToT requires more tokens, more turns, and more prompt
              engineering. For simple factual questions or straightforward tasks, it&rsquo;s
              overkill. CoT is usually enough. ToT shines when the problem space has
              multiple viable approaches and committing to the first one is risky.
            </p>

            <h2 id="when-tot-wins">When ToT outperforms standard prompting</h2>
            <p>
              The original paper demonstrated large improvements on three benchmark tasks:
              Game of 24 (mathematical reasoning requiring backtracking), Creative
              Writing (generating a coherent passage across multiple constraints), and
              Mini Crosswords. What these have in common: wrong early choices derail the
              whole solution, and the search space benefits from exploration.
            </p>
            <p>
              Practical situations where ToT is worth the setup cost:
            </p>
            <ul>
              <li>
                <strong>Multi-step planning with constraints.</strong> Writing a project
                plan where some options are mutually exclusive, or a technical architecture
                where choosing one approach precludes another.
              </li>
              <li>
                <strong>Creative work requiring constraint satisfaction.</strong> Writing
                that has to hit multiple tonal, structural, and content requirements
                simultaneously. The model needs to hold all constraints as it explores
                rather than satisfying them one at a time.
              </li>
              <li>
                <strong>Debugging with multiple competing hypotheses.</strong> When
                you have three possible causes and want to explore each before deciding
                which to investigate, ToT lets you run the exploration in parallel
                rather than sequentially.
              </li>
              <li>
                <strong>Decision analysis.</strong> Evaluating a strategic decision
                where each option has different downstream implications — you want to
                model each path independently before comparing.
              </li>
            </ul>
            <p>
              For tasks with a clear single answer, straightforward step-by-step CoT
              is usually better. ToT&rsquo;s advantage comes specifically from backtracking
              and parallel exploration.
            </p>

            <h2 id="how-to-apply">How to apply Tree of Thought manually</h2>
            <p>
              You don&rsquo;t need a custom implementation to use Tree of Thought. Here are
              three prompt patterns that work in any chat interface:
            </p>

            <h3>The brainstorm-then-evaluate pattern</h3>
            <p>
              Ask for multiple candidates in one turn, then ask the model to evaluate
              them before picking one:
            </p>
            <p>
              <em>&ldquo;Give me three distinct approaches to [problem]. For each, explain
              the core logic and the main risk. Then tell me which you&rsquo;d pursue first
              and why.&rdquo;</em>
            </p>
            <p>
              This is the simplest ToT approximation. The model generates candidates,
              evaluates, and selects — all in one response. Limitation: you see the
              result of the evaluation, not the reasoning that led to it being discarded.
            </p>

            <h3>The explicit backtracking pattern</h3>
            <p>
              Let the model commit to an approach, then ask it to reconsider before
              continuing:
            </p>
            <p>
              <em>&ldquo;Before continuing with that plan: what&rsquo;s the strongest argument
              against it? Is there an alternative approach you initially considered and
              ruled out that might actually be better?&rdquo;</em>
            </p>
            <p>
              This surfaces discarded paths. Models often have a &ldquo;first response
              commitment&rdquo; tendency — this prompt interrupts it.
            </p>

            <h3>The step-by-step evaluation pattern</h3>
            <p>
              For longer chains, add evaluation checkpoints:
            </p>
            <p>
              <em>&ldquo;At each step, before continuing, list one alternative path you
              could take instead. Briefly assess whether it&rsquo;s worth exploring, then
              continue on the main path.&rdquo;</em>
            </p>
            <p>
              This makes the tree structure explicit in the response. Slower, but the
              reasoning is visible.
            </p>

            <div className="bl-cta-inline">
              <h3>ToT on a canvas, not a scroll.</h3>
              <p>
                Nodea lets you run ToT exploration across real branches — each path
                is its own conversation, visible on the tree.
              </p>
              <Link href="/login" className="ln-btn ln-btn-primary">
                Try Nodea free →
              </Link>
            </div>

            <h2 id="the-interface-problem">The interface problem</h2>
            <p>
              Here&rsquo;s the tension: Tree of Thought is, by definition, a non-linear
              reasoning process. But the chat interface you&rsquo;re using is linear. The
              disconnect creates three practical problems.
            </p>

            <h3>Branches collapse into a single thread</h3>
            <p>
              If you use the brainstorm-then-evaluate pattern, all three candidate paths
              appear in one response. You see the winner, but you can&rsquo;t continue
              exploring the alternatives — they&rsquo;re text in a response, not live
              branches. Once you continue the conversation, those paths are gone.
            </p>

            <h3>Context accumulates across the exploration</h3>
            <p>
              If you run multiple candidate paths in the same thread — first trying
              approach A, then approach B — the model&rsquo;s context for approach B now
              includes all of approach A&rsquo;s content. The paths aren&rsquo;t independent.
              The model may subtly mix context from one path into another, or resist
              the backtrack because the failed approach is still in its window.
            </p>

            <h3>You can&rsquo;t compare branches</h3>
            <p>
              Even if you successfully explore two paths, you can&rsquo;t read them side
              by side. You scroll up and down a single thread. The comparison lives in
              your memory, not on the screen.
            </p>

            <h2 id="tot-plus-branching">Tree of Thought + a branching interface</h2>
            <p>
              A branching chat interface is the natural complement to Tree of Thought
              prompting. The connection is direct: ToT is a technique where the model
              explores a tree of reasoning. A branching interface is an environment
              where the user explores a tree of conversations.
            </p>
            <p>
              When you use ToT in a branching interface like Nodea:
            </p>
            <ul>
              <li>
                Each candidate reasoning path becomes its own branch. The branches are
                independent — the model context for branch B doesn&rsquo;t include
                branch A&rsquo;s content.
              </li>
              <li>
                You can continue each path as a live conversation, not just as text
                in a response. Ask follow-up questions on the approach the model suggested
                and evaluate it more deeply before comparing.
              </li>
              <li>
                The full tree is visible on a canvas. You can see which paths were
                explored, which were abandoned, and the relative depth of each.
              </li>
              <li>
                Backtracking is literal: click the node you want to branch from and
                start a new conversation from that point. No workarounds, no re-explaining.
              </li>
            </ul>
            <p>
              The result is that the ToT technique, which is cumbersome to run in a
              linear chat, becomes the default way of working.{' '}
              <Link href="/blog/branching-ai-chat-guide">
                The branching AI chat guide
              </Link>{' '}
              covers the full picture of how branching interfaces work.
            </p>

            <h2 id="faq">FAQ</h2>

            <h3>Do I need to code anything to use Tree of Thought?</h3>
            <p>
              No. The brainstorm-then-evaluate and explicit backtracking patterns work
              with any chat interface through plain prompting. The academic implementations
              that use BFS/DFS search algorithms require code, but practical ToT doesn&rsquo;t.
            </p>

            <h3>Does Tree of Thought always give better results?</h3>
            <p>
              No. For simple tasks — factual questions, clear-step instructions, basic
              summarization — Chain of Thought or no special prompting at all is faster
              and cheaper. ToT adds value specifically when the problem benefits from
              exploring multiple approaches before committing.
            </p>

            <h3>Is Tree of Thought the same as &ldquo;asking for alternatives&rdquo;?</h3>
            <p>
              Related but different. Asking for alternatives (&ldquo;give me three options&rdquo;)
              generates candidates. ToT additionally asks the model to evaluate each
              option, continue the most promising, and backtrack from unproductive paths.
              The evaluation and backtracking steps are what distinguish it from a
              simple brainstorm.
            </p>

            <h3>Which models support Tree of Thought best?</h3>
            <p>
              Any capable model can follow ToT-style prompting. In practice, models
              with strong instruction following and long-context handling work best —
              Claude (Sonnet and Opus) and GPT-4 class models are the common choices.
              The technique is model-agnostic; the quality of evaluation reasoning
              varies by model.
            </p>

            <h3>What&rsquo;s the difference between Tree of Thought and ReAct?</h3>
            <p>
              ReAct (Reason + Act) interleaves reasoning with external tool calls —
              the model reasons, takes an action (search, code execution, etc.), observes
              the result, and repeats. Tree of Thought is purely internal: it explores
              reasoning paths without external actions. They&rsquo;re complementary; you can
              combine them in agentic systems.
            </p>
          </div>
        </div>

        <section className="bl-article-end-cta">
          <div className="ln-container">
            <h2>Think in trees, not lists.</h2>
            <p>Open a free Nodea canvas — built for exploratory, branching reasoning.</p>
            <Link href="/login" className="ln-btn ln-btn-primary ln-btn-lg">
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
