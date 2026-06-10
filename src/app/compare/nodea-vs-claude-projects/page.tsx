import type { Metadata } from 'next'
import ComparePage from '../ComparePage'
import { OG_IMAGES } from '@/lib/og'
import '@/app/_components/landing/landing.css'
import '../compare.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea vs Claude Projects — Branching AI Canvas' },
  description:
    'Honest comparison: Nodea vs Claude Projects. Both run on Claude — one adds branching, the other persistent project memory. How to choose.',
  alternates: { canonical: '/compare/nodea-vs-claude-projects' },
  openGraph: {
    title: 'Nodea vs Claude Projects — Honest Comparison',
    description: 'Both run on Claude. One is a branching canvas, one is a project workspace. Side-by-side comparison.',
    url: 'https://nodea.ai/compare/nodea-vs-claude-projects',
    images: OG_IMAGES,
  },
}

export default function NodeaVsClaudeProjects() {
  return (
    <ComparePage
      slug="nodea-vs-claude-projects"
      competitorName="Claude Projects"
      title="Nodea vs Claude Projects"
      description="Both Nodea and Claude Projects sit on top of Anthropic&rsquo;s Claude models. The difference is what they optimize for. Claude Projects is built for persistent project context. Nodea is built for non-linear exploration."
      tldr={'Pick Claude Projects if your workflow is "same big context, many sessions" — uploaded files, instructions, persistent memory. Pick Nodea if your workflow is "same starting point, many alternatives" — branching, forking, side-by-side comparison. Many users keep both.'}
      rows={[
        { feature: 'Conversation shape',  competitor: 'Linear thread per chat',  nodea: 'Tree of nodes (branching)', nodeaWins: true },
        { feature: 'Fork any reply',      competitor: 'Regenerate only',         nodea: 'Branch any node',           nodeaWins: true },
        { feature: 'Project context',     competitor: 'Persistent files + instructions', nodea: 'Per-canvas, plus cross-chat memory (Pro)' },
        { feature: 'File uploads',        competitor: 'PDFs, docs, images',      nodea: 'Images, PDFs, text files in chat' },
        { feature: 'Visual canvas',       competitor: 'No',                      nodea: 'Pan-and-zoom tree',          nodeaWins: true },
        { feature: 'Models available',    competitor: 'Sonnet, Opus (Pro plans)', nodea: 'Haiku, Sonnet, Opus (Opus = Pro)' },
        { feature: 'Free tier',           competitor: 'Limited messages/day',    nodea: '25k/day · 450k/mo, Haiku + Sonnet' },
        { feature: 'Price',               competitor: '$20/mo Pro, $25/mo Teams', nodea: '$8/mo Pro',                  nodeaWins: true },
        { feature: 'Anonymous sign-in',   competitor: 'No',                      nodea: 'Yes',                        nodeaWins: true },
        { feature: 'Auto model routing',  competitor: 'Manual',                  nodea: 'Automatic by complexity',    nodeaWins: true },
      ]}
      whenCompetitor={{
        heading: 'When Claude Projects is the better choice',
        bullets: [
          "You work on the same long-running project across many sessions and need persistent context.",
          "You routinely upload large files (long PDFs, codebases) that the AI should always reference.",
          "You want custom instructions that apply to every conversation in that project automatically.",
          "You’re already paying for Claude.ai Pro and just need the file persistence feature.",
        ],
      }}
      whenNodea={{
        heading: 'When Nodea is the better choice',
        bullets: [
          "You want to explore multiple framings of the same question without losing any of them.",
          "You think visually — you want to see your conversation as a map, not a scroll.",
          "You want to fork from any message, not just regenerate the last reply.",
          "You want anonymous sign-in and a free tier that’s actually usable.",
          "You’d rather pay $8/mo than $20/mo.",
        ],
      }}
      faq={[
        {
          q: "Do Nodea and Claude Projects use the same AI?",
          a: "Yes — both run on Anthropic’s Claude models (Haiku, Sonnet, Opus). The model output quality is functionally identical; the differentiator is the interface around the model.",
        },
        {
          q: "Can I branch in Claude Projects?",
          a: "Only by using Claude.ai’s &ldquo;regenerate&rdquo; feature, which creates alternative versions of the most recent assistant reply. You can’t fork from a user message, you can’t see all branches on a canvas, and the branch doesn’t survive past the next turn.",
        },
        {
          q: "Does Nodea support project-style file uploads?",
          a: "You can attach images, PDFs, and text files to individual messages in Nodea. We don’t yet have Claude-Projects-style global file context that persists across every conversation — it’s on the roadmap.",
        },
        {
          q: "Is Nodea cheaper than Claude.ai?",
          a: "Yes. Nodea Pro is $8/mo (rate-locked for early adopters) vs Claude.ai Pro at $20/mo. Both unlock Claude Opus.",
        },
        {
          q: "Can I use both?",
          a: "Many users do. Use Claude Projects for long-running projects with persistent files; use Nodea when you need to explore alternatives or compare multiple framings.",
        },
      ]}
    />
  )
}
