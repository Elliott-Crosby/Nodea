import type { Metadata } from 'next'
import ComparePage from '../ComparePage'
import { OG_IMAGES } from '@/lib/og'
import '@/app/_components/landing/landing.css'
import '../compare.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea vs TypingMind — Branching AI Canvas' },
  description:
    'Honest comparison: Nodea vs TypingMind. TypingMind is a multi-provider BYOK frontend. Nodea is a branching canvas on Claude. How to choose.',
  alternates: { canonical: '/compare/nodea-vs-typingmind' },
  openGraph: {
    title: 'Nodea vs TypingMind — Honest Comparison',
    description: 'A branching canvas on Claude vs a multi-model BYOK chat frontend.',
    url: 'https://nodea.ai/compare/nodea-vs-typingmind',
    images: OG_IMAGES,
  },
}

export default function NodeaVsTypingMind() {
  return (
    <ComparePage
      slug="nodea-vs-typingmind"
      competitorName="TypingMind"
      title="Nodea vs TypingMind"
      description="TypingMind is a polished bring-your-own-key frontend that supports many model providers. Nodea is a branching AI chat canvas built specifically for non-linear conversations on Claude."
      tldr={'Pick TypingMind if you want to bring your own API keys, swap between providers (OpenAI, Anthropic, Gemini, local), and use a linear chat UI with plugins and prompt libraries. Pick Nodea if you want branching as a first-class feature, automatic model routing, and zero setup: open an account, open a canvas.'}
      rows={[
        { feature: 'Conversation shape',    competitor: 'Linear with folders',         nodea: 'Tree (branching canvas)',    nodeaWins: true },
        { feature: 'Fork any reply',        competitor: 'Limited (regenerate)',        nodea: 'Click any node, branch',     nodeaWins: true },
        { feature: 'Visual canvas',         competitor: 'No',                          nodea: 'Pan-and-zoom tree',          nodeaWins: true },
        { feature: 'Model providers',       competitor: 'OpenAI, Anthropic, Gemini, local', nodea: 'Anthropic Claude' },
        { feature: 'Bring-your-own keys',   competitor: 'Yes, required',               nodea: 'Roadmap; today managed' },
        { feature: 'Auto model routing',    competitor: 'Manual selection',            nodea: 'Auto by complexity',         nodeaWins: true },
        { feature: 'Anonymous sign-in',     competitor: 'No (local storage)',          nodea: 'Yes (Supabase anon auth)',   nodeaWins: true },
        { feature: 'Free tier',             competitor: 'Free app, pay your own API',  nodea: 'Free 25k/day · 450k/mo, ours' },
        { feature: 'Price',                 competitor: '$39 one-time + API costs',    nodea: '$8/mo subscription' },
        { feature: 'Plugin system',         competitor: 'Yes',                         nodea: 'Not yet' },
      ]}
      whenCompetitor={{
        heading: 'When TypingMind is the better choice',
        bullets: [
          "You want to use your own API keys and avoid any per-message markup from a hosted product.",
          "You need to switch between multiple model providers in one tool (OpenAI, Anthropic, Gemini, local LLMs).",
          "You want a plugin ecosystem and prompt-library features.",
          "You’d rather pay one lump-sum than a monthly subscription.",
        ],
      }}
      whenNodea={{
        heading: 'When Nodea is the better choice',
        bullets: [
          "You think in branches and want a real visual canvas, not a flat thread list.",
          "You want zero setup: open an account, get free tokens, start chatting.",
          "You want automatic model routing so you’re not constantly thinking about which model to use.",
          "You prefer Claude specifically and don’t need GPT or other providers in the same tool.",
          "You don’t want to manage and rotate your own API keys yet.",
        ],
      }}
      faq={[
        {
          q: "Does Nodea support bring-your-own-key like TypingMind?",
          a: "Not yet — it’s on the roadmap. Today, Nodea uses managed Anthropic keys and gives you a per-plan daily token budget. TypingMind is BYOK from the start.",
        },
        {
          q: "Can I use models other than Claude in Nodea?",
          a: "No — Nodea is Claude-only by design. TypingMind supports OpenAI, Anthropic, Gemini, and local LLMs in one app.",
        },
        {
          q: "Does TypingMind support branching?",
          a: "It supports regeneration of the last assistant reply, but it doesn’t have a visual canvas or fork-from-any-node behavior. Branching is Nodea’s primary differentiator.",
        },
        {
          q: "Is Nodea more expensive in the long run?",
          a: "It depends on usage. TypingMind is a $39 one-time purchase, but you pay Anthropic / OpenAI per-token on top. Nodea is $8/mo all-in. For light users, TypingMind plus BYOK is cheaper. For mid-to-heavy users, Nodea’s flat fee usually wins.",
        },
        {
          q: "Can I export my conversations from Nodea?",
          a: "Yes — your data lives in your Supabase row, isolated by RLS. Full export tooling is on the roadmap.",
        },
      ]}
    />
  )
}
