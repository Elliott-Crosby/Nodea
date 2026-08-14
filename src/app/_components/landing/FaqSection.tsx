/**
 * Homepage FAQ section.
 *
 * Visible content MUST match the FAQPage JSON-LD exactly (Google bans
 * mismatched/hidden FAQ markup). Speakable schema is applied to FAQ
 * answers as a voice-extraction hint for AI Overviews.
 *
 * Intentionally distinct from the FAQs on /what-is-nodea (different
 * phrasings / different angles) to avoid duplicate-FAQ penalties.
 */

export interface FaqItem {
  q: string
  a: string
}

export const HOMEPAGE_FAQ: FaqItem[] = [
  {
    q: 'What does Nodea do?',
    a: 'Nodea lets you chat with Anthropic Claude on a branching canvas instead of one linear thread. Every reply becomes a node. Fork any node to ask the question a different way, explore an alternative, or compare two answers side by side without losing the original path.',
  },
  {
    q: 'What is branching AI chat?',
    a: 'Branching AI chat is a conversation interface where each message is stored as a node in a tree. From any node you can start a new branch: a separate path that explores an alternative without overwriting the original. Linear chatbots (ChatGPT, Claude.ai) only let you append, edit, or start over.',
  },
  {
    q: 'Why would I use Nodea instead of ChatGPT?',
    a: 'Nodea is the better tool when you want to explore alternatives (different tones, framings, or plans from the same starting point) without losing any of them. ChatGPT is the better tool for a single linear question-and-answer session, or when you need OpenAI-specific features like image generation. Nodea Pro is $24/mo — a few dollars more than ChatGPT Plus at $20/mo — but you’re paying for the branching canvas and Claude Opus, not a cheaper linear chatbot.',
  },
  {
    q: 'Can I try Nodea without signing up?',
    a: 'Yes. Nodea supports anonymous sign-in: a real account with no email address required. Open a canvas, branch, and save projects immediately, then link an email later to claim your data.',
  },
  {
    q: 'How much does Nodea cost?',
    a: 'Nodea is free during beta with 50,000 daily / 500,000 monthly tokens on Claude Sonnet 5. The Pro plan is $24/month and unlocks Claude Opus, a 300,000 daily / 3,000,000 monthly token budget, and early access to new features. Cancel anytime.',
  },
  {
    q: 'Which AI models power Nodea?',
    a: 'Nodea runs on Anthropic Claude: Sonnet 5 powers every conversation, and Pro routes the heaviest tasks to Opus. The model is selected automatically based on prompt complexity and your plan tier.',
  },
  {
    q: 'Is Nodea open source?',
    a: 'Yes. The Nodea source is MIT-licensed and available on GitHub. The hosted product runs at nodea.ai; you can self-host the same codebase against your own Supabase project and Anthropic API key.',
  },
]

export default function FaqSection() {
  return (
    <section id="faq" className="ln-faq" aria-labelledby="faq-heading">
      <div className="ln-container">
        <div className="ln-faq-head">
          <span className="ln-kicker">FAQ</span>
          <h2 id="faq-heading" className="ln-h2">
            Frequently asked,<br />
            <em>plainly answered.</em>
          </h2>
        </div>

        <div className="ln-faq-list">
          {HOMEPAGE_FAQ.map(({ q, a }, i) => (
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
  )
}
