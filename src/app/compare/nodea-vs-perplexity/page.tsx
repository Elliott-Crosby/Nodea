import type { Metadata } from 'next'
import ComparePage from '../ComparePage'
import { OG_IMAGES } from '@/lib/og'
import '@/app/_components/landing/landing.css'
import '../compare.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea vs Perplexity — Branching AI Canvas' },
  description:
    'Honest comparison: Nodea vs Perplexity. Perplexity is an AI answer engine with cited web search. Nodea is a branching canvas on Claude. How to choose.',
  alternates: { canonical: '/compare/nodea-vs-perplexity' },
  openGraph: {
    title: 'Nodea vs Perplexity — Honest Comparison',
    description: 'A branching canvas on Claude vs an AI answer engine with cited web search.',
    url: 'https://nodea.ai/compare/nodea-vs-perplexity',
    images: OG_IMAGES,
  },
}

export default function NodeaVsPerplexity() {
  return (
    <ComparePage
      slug="nodea-vs-perplexity"
      competitorName="Perplexity"
      title="Nodea vs Perplexity"
      description="Perplexity is an AI answer engine optimized for web search with cited sources and linear Q&A threads. Nodea is a branching AI chat canvas built for exploring ideas across forks on Claude."
      tldr={'Pick Perplexity if your main job is searching the web and getting fast, well-cited answers from live sources across multiple models. Pick Nodea if your main job is exploring an idea: branching from any reply into a visual tree, comparing paths side by side, and keeping every thread you spin off, all on Claude with zero setup. Search-and-cite vs branch-and-explore are different tools for different jobs.'}
      rows={[
        { feature: 'Primary job',          competitor: 'Search the web, cite answers',     nodea: 'Branch and explore ideas',    nodeaWins: true },
        { feature: 'Conversation shape',    competitor: 'Linear Q&A threads',               nodea: 'Tree (branching canvas)',     nodeaWins: true },
        { feature: 'Fork any reply',        competitor: 'No (follow-ups stay in line)',     nodea: 'Click any node, branch',      nodeaWins: true },
        { feature: 'Visual canvas',         competitor: 'No',                               nodea: 'Pan-and-zoom tree',           nodeaWins: true },
        { feature: 'Live web search',       competitor: 'Yes, core feature',                nodea: 'No (chat on Claude)' },
        { feature: 'Source citations',      competitor: 'Yes, inline citations',            nodea: 'No' },
        { feature: 'Models',                competitor: 'GPT, Claude, Gemini and more',     nodea: 'Anthropic Claude' },
        { feature: 'Auto model routing',    competitor: 'Manual / auto modes',              nodea: 'Auto by complexity',          nodeaWins: true },
        { feature: 'Anonymous sign-in',     competitor: 'No (account or app)',              nodea: 'Yes (Supabase anon auth)',    nodeaWins: true },
        { feature: 'Free tier',             competitor: 'Free with limits',                 nodea: 'Free 25k/day · 450k/mo' },
        { feature: 'Paid price',            competitor: '$20/mo (Pro)',                     nodea: '$8/mo subscription' },
      ]}
      whenCompetitor={{
        heading: 'When Perplexity is the better choice',
        bullets: [
          "Your main job is researching the live web and you need fast answers with inline citations you can click through to the source.",
          "You want answers grounded in current information, not just a model’s training data.",
          "You want one tool that draws on multiple model providers (GPT, Claude, Gemini) behind a search-first interface.",
          "You’re fact-finding or fact-checking and the citation trail matters more than exploring alternative directions.",
        ],
      }}
      whenNodea={{
        heading: 'When Nodea is the better choice',
        bullets: [
          "You’re thinking through an idea and want to fork any reply into a new branch instead of losing the original path.",
          "You want a real visual canvas: pan and zoom a tree of branches, compare paths side by side, not scroll one long thread.",
          "You want zero setup: open an account, get free tokens, start branching.",
          "You want automatic model routing on Claude so you’re not picking a model for every message.",
          "Your work is open-ended exploration, drafting, or reasoning, not primarily live web lookup.",
        ],
      }}
      faq={[
        {
          q: "Is Nodea a search engine like Perplexity?",
          a: "No. Perplexity is an answer engine: you ask a question, it searches the live web and returns a cited answer. Nodea is a branching chat canvas on Claude, built for exploring and forking ideas, not for web search with citations.",
        },
        {
          q: "Does Nodea cite sources from the web?",
          a: "No. Nodea doesn’t do live web search or inline citations; that’s Perplexity’s core strength. Nodea is for branching conversations on Claude, where you fork replies into a visual tree.",
        },
        {
          q: "Can Perplexity branch conversations into a tree?",
          a: "No. Perplexity keeps follow-ups in a linear thread; there’s no visual canvas or fork-from-any-node behavior. Branching is Nodea’s primary differentiator.",
        },
        {
          q: "Which models does each use?",
          a: "Perplexity gives paid users a choice of providers (GPT, Claude, Gemini, and others) behind a search-first UI. Nodea is Claude-only by design and routes between Haiku, Sonnet, and Opus automatically by complexity.",
        },
        {
          q: "Can I use both together?",
          a: "Many people do. Use Perplexity to research and gather cited facts, then bring the thinking into Nodea to branch, draft, and explore alternatives on a canvas. They solve different problems: search-and-cite vs branch-and-explore.",
        },
        {
          q: "How does pricing compare?",
          a: "Perplexity Pro is about $20/mo. Nodea is $8/mo, and free during beta with no credit card, roughly 25k tokens/day and 450k/mo on the free tier.",
        },
      ]}
    />
  )
}
