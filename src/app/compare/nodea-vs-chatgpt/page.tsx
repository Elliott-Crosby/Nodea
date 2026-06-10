import type { Metadata } from 'next'
import ComparePage from '../ComparePage'
import { OG_IMAGES } from '@/lib/og'
import '@/app/_components/landing/landing.css'
import '../compare.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea vs ChatGPT — Branching AI Chat Canvas' },
  description:
    'Honest comparison: Nodea vs ChatGPT. Compare branching, model selection, data ownership, and price. When ChatGPT wins, when Nodea wins, and how to decide.',
  alternates: { canonical: '/compare/nodea-vs-chatgpt' },
  openGraph: {
    title: 'Nodea vs ChatGPT — Honest Comparison',
    description: 'Branching AI chat vs the linear ChatGPT thread. Side-by-side feature table.',
    url: 'https://nodea.ai/compare/nodea-vs-chatgpt',
    images: OG_IMAGES,
  },
}

export default function NodeaVsChatGPT() {
  return (
    <ComparePage
      slug="nodea-vs-chatgpt"
      competitorName="ChatGPT"
      title="Nodea vs ChatGPT"
      description="ChatGPT is the default AI chatbot. Nodea is built for non-linear thinking. Here&rsquo;s how they actually compare — without the marketing fluff."
      tldr="If you have one question and want one answer, ChatGPT is fine. If you regularly explore alternatives, compare framings, or get frustrated losing context, Nodea&rsquo;s tree-shaped canvas pays for itself on the first session. Both run on top-tier models — ChatGPT on GPT-4o/5, Nodea on Claude Haiku, Sonnet, and Opus."
      rows={[
        { feature: 'Conversation shape',     competitor: 'Linear thread',             nodea: 'Tree (branching canvas)', nodeaWins: true },
        { feature: 'Fork any reply',         competitor: 'Only via edit (hidden)',    nodea: 'Click any node, branch',  nodeaWins: true },
        { feature: 'Visual map of chats',    competitor: 'Sidebar list',              nodea: 'Pan-and-zoom tree canvas', nodeaWins: true },
        { feature: 'Underlying model',       competitor: 'GPT-4o / GPT-5',            nodea: 'Claude Haiku 4.5 / Sonnet 4.6 / Opus 4.7' },
        { feature: 'Auto model routing',     competitor: 'Manual model picker',       nodea: 'Auto by prompt complexity', nodeaWins: true },
        { feature: 'Anonymous sign-in',      competitor: 'Email required',            nodea: 'Yes — no email needed', nodeaWins: true },
        { feature: 'Free tier',              competitor: 'GPT-4o limits, then GPT-3.5', nodea: '25k/day · 450k/mo, Haiku + Sonnet' },
        { feature: 'Paid tier',              competitor: '$20/mo',                    nodea: '$8/mo (Opus + 50k/day · 1M/mo)', nodeaWins: true },
        { feature: 'Open source',            competitor: 'No',                        nodea: 'Yes — MIT, source on GitHub', nodeaWins: true },
        { feature: 'Data isolation',         competitor: 'OpenAI cloud',              nodea: 'Supabase Postgres with RLS' },
      ]}
      whenCompetitor={{
        heading: 'When ChatGPT is the better choice',
        bullets: [
          "You only need a single, linear conversation per session and don’t care about preserving alternatives.",
          "You already have a ChatGPT Plus subscription and use GPT-specific features like custom GPTs or the desktop app.",
          "You need OpenAI-specific tooling (DALL·E image gen, advanced voice mode, the Sora video integrations).",
          "You’re inside an enterprise that has standardized on OpenAI for compliance reasons.",
        ],
      }}
      whenNodea={{
        heading: 'When Nodea is the better choice',
        bullets: [
          "You routinely explore alternatives — different tones, different framings, different plans — and hate losing the original.",
          "You prefer Claude’s writing and reasoning quality (Sonnet and Opus are widely considered best-in-class for nuanced text).",
          "You want a visual map of your thinking, not a buried scroll history.",
          "You want anonymous sign-in to try without committing an email address.",
          "You’d rather pay $8/mo than $20/mo for equivalent or better daily token budgets.",
        ],
      }}
      faq={[
        {
          q: "Is Nodea a ChatGPT clone?",
          a: "No. Nodea uses Anthropic’s Claude models, not OpenAI’s GPT. More importantly, the data model is fundamentally different — Nodea stores conversations as trees, ChatGPT stores them as lists.",
        },
        {
          q: "Can I fork a conversation in ChatGPT?",
          a: "Partially. ChatGPT lets you edit a prior user message, which creates a hidden version branch. You can’t fork an assistant message and the UI for switching branches is intentionally minimal. Nodea makes branching the default behavior.",
        },
        {
          q: "Is Claude better than GPT?",
          a: "It depends on the task. Claude (especially Sonnet 4.6 and Opus 4.7) is widely regarded as best-in-class for nuanced writing, long-context reasoning, and code generation. GPT-4o is stronger at image generation and certain multimodal tasks. The honest answer is to try both on your real work.",
        },
        {
          q: "Why is Nodea cheaper than ChatGPT?",
          a: "Nodea is in early beta and using aggressive launch pricing ($8/mo vs ChatGPT Plus at $20/mo). Pro users get rate-locked at $8 forever as a thanks for trying us early.",
        },
        {
          q: "Can I use ChatGPT and Nodea together?",
          a: "Of course. Many users keep ChatGPT for image generation and voice mode, and use Nodea when they need to explore alternatives or compare branches. They’re complementary, not strictly competitive.",
        },
      ]}
    />
  )
}
