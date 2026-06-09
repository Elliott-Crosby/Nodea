import type { Metadata } from 'next'
import ComparePage from '../ComparePage'
import '@/app/_components/landing/landing.css'
import '../compare.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea vs Poe — Branching AI Canvas' },
  description:
    'Honest comparison: Nodea vs Poe. Poe aggregates many bots and models in one app. Nodea is a visual branching canvas on Claude. How to choose.',
  alternates: { canonical: '/compare/nodea-vs-poe' },
  openGraph: {
    title: 'Nodea vs Poe — Honest Comparison',
    description: 'A visual branching canvas on Claude vs a multi-bot, multi-model chat aggregator.',
    url: 'https://nodea.ai/compare/nodea-vs-poe',
  },
}

export default function NodeaVsPoe() {
  return (
    <ComparePage
      slug="nodea-vs-poe"
      competitorName="Poe"
      title="Nodea vs Poe"
      description="Poe (by Quora) aggregates many AI bots and model providers in one app with linear chats. Nodea is a branching AI chat canvas built specifically for non-linear exploration on Claude."
      tldr={'Pick Poe if you want breadth — hundreds of bots and models (GPT, Claude, Gemini, image and video models) in one place, with a points-based plan that lets you switch tools mid-task. Pick Nodea if you want non-linear exploration as a first-class feature: a visual pan-and-zoom tree where every branch lives on one canvas, plus automatic Claude model routing and zero setup.'}
      rows={[
        { feature: 'Conversation shape',    competitor: 'Linear chats',                  nodea: 'Tree (branching canvas)',    nodeaWins: true },
        { feature: 'Branch from a reply',   competitor: 'Yes — copies into a new chat',  nodea: 'Fork any node in place' },
        { feature: 'Visual canvas',         competitor: 'No — separate threads',         nodea: 'Pan-and-zoom tree',          nodeaWins: true },
        { feature: 'Compare branches',      competitor: 'Switch between chats',          nodea: 'Side-by-side on one canvas', nodeaWins: true },
        { feature: 'Model providers',       competitor: 'Many (GPT, Claude, Gemini, +)', nodea: 'Anthropic Claude' },
        { feature: 'Breadth of bots',       competitor: 'Hundreds, plus custom bots',    nodea: 'Focused on Claude chat' },
        { feature: 'Auto model routing',    competitor: 'Pick a bot per chat',           nodea: 'Auto by complexity',         nodeaWins: true },
        { feature: 'Anonymous sign-in',     competitor: 'Account required',              nodea: 'Yes (Supabase anon auth)',   nodeaWins: true },
        { feature: 'Free tier',             competitor: 'Free plan (limited points)',    nodea: 'Free 25k/day · 450k/mo' },
        { feature: 'Pricing model',         competitor: 'Points-based subscriptions',    nodea: '$8/mo flat (free in beta)' },
      ]}
      whenCompetitor={{
        heading: 'When Poe is the better choice',
        bullets: [
          "You want breadth — many models and bots from different providers (GPT, Claude, Gemini, image and video models) in a single app.",
          "You like switching tools mid-task and trying community or custom bots without leaving one interface.",
          "You want image and video generation alongside text chat in the same product.",
          "A points-based plan that spreads across many models fits how you work better than a single-provider budget.",
        ],
      }}
      whenNodea={{
        heading: 'When Nodea is the better choice',
        bullets: [
          "You think in branches and want a real visual canvas — a pan-and-zoom tree, not a list of separate chats.",
          "You want to compare alternative branches side by side on one canvas instead of switching between threads.",
          "You want zero setup — open an account, get free tokens, start exploring.",
          "You want automatic model routing across Claude tiers so you’re not picking a bot for every conversation.",
          "You prefer Claude specifically and don’t need a hundred other bots in the same tool.",
        ],
      }}
      faq={[
        {
          q: "Can Poe branch conversations?",
          a: "Yes — Poe lets you branch from any message, which copies the conversation up to that point into a new chat. It’s a genuinely useful feature. The difference is shape: Poe branches become separate linear chats, while Nodea keeps every branch on one visual pan-and-zoom canvas so you can see and compare the whole tree at once.",
        },
        {
          q: "Does Nodea support multiple model providers like Poe?",
          a: "No — Nodea is Claude-only by design (Haiku 4.5, Sonnet 4.6, Opus) with automatic routing by complexity. Poe’s strength is breadth: hundreds of bots and models from many providers, plus image and video tools, in one app.",
        },
        {
          q: "Which is better for exploring lots of alternatives at once?",
          a: "Nodea, if your goal is to explore one problem deeply. Forking any reply and seeing every path as a tree on a single canvas is its core purpose. Poe can branch too, but each branch opens as its own chat rather than a node on a shared canvas.",
        },
        {
          q: "How does pricing compare?",
          a: "Poe uses points-based subscription tiers, where heavier models consume points faster — flexible across many models. Nodea is a single $8/mo flat plan (free during beta, no credit card) with a daily Claude token budget. If you want many providers, Poe’s model fits; if you want predictable Claude usage, Nodea’s does.",
        },
        {
          q: "Can I export my conversations from Nodea?",
          a: "Yes — your data lives in your Supabase row, isolated by RLS. Full export tooling is on the roadmap.",
        },
      ]}
    />
  )
}
