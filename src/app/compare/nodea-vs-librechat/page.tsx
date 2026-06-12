import type { Metadata } from 'next'
import ComparePage from '../ComparePage'
import { OG_IMAGES } from '@/lib/og'
import '@/app/_components/landing/landing.css'
import '../compare.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea vs LibreChat — Branching AI Canvas' },
  description:
    'Honest comparison: Nodea vs LibreChat. LibreChat is an open-source, self-hosted, multi-provider chat UI with forking. Nodea is a hosted Claude canvas.',
  alternates: { canonical: '/compare/nodea-vs-librechat' },
  openGraph: {
    title: 'Nodea vs LibreChat — Honest Comparison',
    description: 'A hosted branching canvas on Claude vs an open-source, self-hosted multi-provider chat UI.',
    url: 'https://nodea.ai/compare/nodea-vs-librechat',
    images: OG_IMAGES,
  },
}

export default function NodeaVsLibreChat() {
  return (
    <ComparePage
      slug="nodea-vs-librechat"
      competitorName="LibreChat"
      title="Nodea vs LibreChat"
      description="LibreChat is a powerful open-source, self-hosted chat UI that connects many providers and supports conversation forking. Nodea is a hosted branching AI chat canvas built for non-linear conversations on Claude, with nothing to install."
      tldr={'Pick LibreChat if you want a free, open-source app you can self-host, connect to many providers (OpenAI, Anthropic, Gemini, Mistral, local Ollama), and own end-to-end; it even supports forking a chat from any message. Pick Nodea if you want zero setup, a true visual pan-and-zoom branching canvas, and automatic Claude model routing without running any infrastructure.'}
      rows={[
        { feature: 'Conversation shape',    competitor: 'Forking (new chat per branch)', nodea: 'Tree on one canvas',          nodeaWins: true },
        { feature: 'Fork any reply',        competitor: 'Yes, fork button per message', nodea: 'Click any node, branch' },
        { feature: 'Visual canvas',         competitor: 'No (tree is a feature request)', nodea: 'Pan-and-zoom tree',          nodeaWins: true },
        { feature: 'Compare branches',      competitor: 'Open forks as separate chats',  nodea: 'Side-by-side on canvas',     nodeaWins: true },
        { feature: 'Hosting',               competitor: 'Self-host (Docker / your infra)', nodea: 'Hosted, nothing to run',   nodeaWins: true },
        { feature: 'Setup',                 competitor: 'Configure keys, server, DB',    nodea: 'Open an account, open canvas', nodeaWins: true },
        { feature: 'Model providers',       competitor: 'OpenAI, Anthropic, Gemini, local', nodea: 'Anthropic Claude' },
        { feature: 'Bring-your-own keys',   competitor: 'Yes, required',                 nodea: 'No, managed keys only' },
        { feature: 'Auto model routing',    competitor: 'Manual selection',              nodea: 'Auto by complexity',         nodeaWins: true },
        { feature: 'Cost model',            competitor: 'Free app + your infra & API',   nodea: 'Free 25k/day · 450k/mo; Pro $8/mo' },
        { feature: 'Open source',           competitor: 'Yes (MIT)',                     nodea: 'Yes (MIT), hosted for you' },
      ]}
      whenCompetitor={{
        heading: 'When LibreChat is the better choice',
        bullets: [
          "You want a free, open-source app (MIT) you can read, modify, and fully control.",
          "You’re comfortable self-hosting: Docker, your own server, database, and API keys.",
          "You need many providers in one tool: OpenAI, Anthropic, Gemini, Mistral, and local models via Ollama.",
          "You want to keep all data on your own infrastructure with no third-party hosting.",
          "You like its broader feature set: agents, MCP, code interpreter, plugins, and per-message forking.",
        ],
      }}
      whenNodea={{
        heading: 'When Nodea is the better choice',
        bullets: [
          "You want zero setup: no Docker, no server, no keys. Open an account and start branching.",
          "You think visually and want a real pan-and-zoom canvas, not forks scattered across separate chats.",
          "You want to compare branches side by side in one view instead of switching between conversations.",
          "You want automatic Claude model routing by complexity instead of picking a model every time.",
          "You prefer Claude specifically and don’t need to run or maintain any infrastructure.",
        ],
      }}
      faq={[
        {
          q: "Does LibreChat support branching like Nodea?",
          a: "Yes. LibreChat has a fork button on each message that creates a new conversation branching from that point, and messages are stored in a tree internally. The difference is presentation: LibreChat opens forks as separate chats, while Nodea shows the whole tree on one visual pan-and-zoom canvas you can compare side by side.",
        },
        {
          q: "Do I have to self-host Nodea?",
          a: "No. Nodea is fully hosted; there’s nothing to install or configure. LibreChat is self-hosted, so you run it yourself (typically via Docker) and supply your own model API keys.",
        },
        {
          q: "Is LibreChat free?",
          a: "The app is free and open-source (MIT). You still pay for your own hosting infrastructure and per-token model API costs. Nodea has a free tier with managed keys (about 25k tokens/day, 450k/month) and a $8/mo Pro plan, with no infrastructure to run.",
        },
        {
          q: "Can I use models other than Claude in Nodea?",
          a: "No. Nodea is Claude-only by design (Haiku 4.5, Sonnet 4.6, Opus) with automatic routing. LibreChat is multi-provider and supports OpenAI, Anthropic, Gemini, Mistral, and local models in one app.",
        },
        {
          q: "Can I export my conversations from Nodea?",
          a: "Yes. Your data lives in your Supabase row, isolated by RLS. Full export tooling is on the roadmap. With LibreChat, the data sits in a database you host yourself.",
        },
      ]}
    />
  )
}
