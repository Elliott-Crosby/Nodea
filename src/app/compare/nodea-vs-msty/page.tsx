import type { Metadata } from 'next'
import ComparePage from '../ComparePage'
import '@/app/_components/landing/landing.css'
import '../compare.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea vs Msty — Branching AI Canvas' },
  description:
    'Honest comparison: Nodea vs Msty. Msty is a local-and-cloud desktop app with split chats. Nodea is a hosted branching canvas on Claude. How to choose.',
  alternates: { canonical: '/compare/nodea-vs-msty' },
  openGraph: {
    title: 'Nodea vs Msty — Honest Comparison',
    description: 'A hosted branching canvas on Claude vs a local-and-cloud multi-model desktop app.',
    url: 'https://nodea.ai/compare/nodea-vs-msty',
  },
}

export default function NodeaVsMsty() {
  return (
    <ComparePage
      slug="nodea-vs-msty"
      competitorName="Msty"
      title="Nodea vs Msty"
      description="Msty is a desktop app that runs local and cloud models in one place, with split chats and offline use. Nodea is a hosted branching AI chat canvas built for non-linear conversations on Claude."
      tldr={'Pick Msty if you want a desktop app that runs local models offline, mixes multiple providers, and compares answers in split panes. Pick Nodea if you want a hosted, zero-setup web canvas where you fork from any reply into a real branching tree, with automatic Claude model routing.'}
      rows={[
        { feature: 'Where it runs',         competitor: 'Desktop app (Mac/Win/Linux)',     nodea: 'Hosted web app',              nodeaWins: true },
        { feature: 'Setup',                 competitor: 'Install app; add models/keys',     nodea: 'Open an account, no install', nodeaWins: true },
        { feature: 'Conversation shape',    competitor: 'Split chats + branch from message', nodea: 'Tree (branching canvas)' },
        { feature: 'Fork any reply',        competitor: 'Yes — branch / Flowchat',          nodea: 'Click any node, branch' },
        { feature: 'Visual canvas',         competitor: 'Flowchart view of a chat',         nodea: 'Pan-and-zoom tree of branches' },
        { feature: 'Model providers',       competitor: 'Local (Ollama) + OpenAI, Claude, more', nodea: 'Anthropic Claude' },
        { feature: 'Offline / local models', competitor: 'Yes',                            nodea: 'No (cloud Claude)' },
        { feature: 'Auto model routing',    competitor: 'Manual selection',                 nodea: 'Auto by complexity',          nodeaWins: true },
        { feature: 'Bring-your-own keys',   competitor: 'Yes (for cloud models)',           nodea: 'Roadmap; today managed' },
        { feature: 'Free tier',             competitor: 'Free desktop app',                 nodea: 'Free 25k/day · 450k/mo, ours' },
        { feature: 'Price',                 competitor: 'Free; paid plans from ~$149/yr',   nodea: '$8/mo subscription' },
      ]}
      whenCompetitor={{
        heading: 'When Msty is the better choice',
        bullets: [
          "You want to run models locally and fully offline, keeping prompts and data on your own machine.",
          "You need multiple providers in one app — local Ollama models alongside OpenAI, Claude, and others.",
          "You prefer a native desktop app over a browser tab, with concurrent sessions and split-pane comparison.",
          "You want a one-time or per-year license instead of a monthly subscription, and you’re fine supplying your own compute or keys.",
        ],
      }}
      whenNodea={{
        heading: 'When Nodea is the better choice',
        bullets: [
          "You want zero setup — no install, no Ollama, no keys. Open an account, get free tokens, start branching.",
          "You think in branches and want a real pan-and-zoom canvas where the whole conversation grows as a tree, not split panes inside one chat.",
          "You want automatic model routing so you’re not picking a Claude tier for every message.",
          "You prefer Claude specifically and don’t need local or multi-provider models.",
          "You want your work hosted and synced across devices rather than tied to one desktop.",
        ],
      }}
      faq={[
        {
          q: "Does Msty support branching like Nodea?",
          a: "Yes — Msty can branch from a message and has split chats and a Flowchat flowchart view, so it’s genuinely capable of non-linear exploration. The difference is form factor: Msty is a desktop app where branching lives inside a chat, while Nodea is a hosted web canvas where the entire conversation is a pan-and-zoom tree of branches you fork from any node.",
        },
        {
          q: "Can Nodea run local or offline models?",
          a: "No — Nodea is cloud Claude only. If running models locally and offline is a requirement, Msty is the better fit; it’s built around local models via Ollama plus cloud providers.",
        },
        {
          q: "Do I have to install anything to use Nodea?",
          a: "No. Nodea runs in the browser — open an account (anonymous sign-in is supported) and start. Msty is a desktop app you download and install, then configure with local models or API keys.",
        },
        {
          q: "Which models can I use in each?",
          a: "Nodea is Anthropic Claude only — Haiku 4.5, Sonnet 4.6, and Opus — with automatic routing by complexity. Msty supports local models via Ollama plus cloud providers like OpenAI and Claude, selected manually.",
        },
        {
          q: "How does pricing compare?",
          a: "Both have a free option. Msty’s free desktop app can run local models with no per-token fee if you supply the compute, and paid plans start around $149/year. Nodea is free during beta and $8/mo after, with managed Claude tokens included so there are no separate API bills.",
        },
        {
          q: "Can I export my conversations from Nodea?",
          a: "Yes — your data lives in your Supabase row, isolated by RLS. Full export tooling is on the roadmap.",
        },
      ]}
    />
  )
}
