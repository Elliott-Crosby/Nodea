import { generateText } from 'ai'
import { anthropic } from '@/lib/anthropic'
import { MODELS } from '@/lib/models'

// ─── Tree state summary ──────────────────────────────────────────────────────
// A short "where this stands" briefing for someone re-opening a branching
// conversation, plus up to a few "open loops" — threads that were raised but
// not resolved or branches left unexplored. The open loops are the on-brand
// part: a linear chat has no unexplored branches; a tree does. Surfacing them
// turns the tree's own structure into the reason to come back.
//
// Mirrors src/lib/memory.ts: a cheap non-streaming Haiku pass that returns
// defensively-parsed JSON. Never throws — callers treat null as "no summary".

export const TREE_SUMMARY_MIN_NODES = 3

const MAX_SUMMARY_LENGTH = 600
const MAX_OPEN_LOOPS     = 3
const MAX_LOOP_LENGTH    = 140
const MAX_NODES_IN_PROMPT = 60
const MAX_CHARS_PER_NODE  = 400

export interface TreeNodeInput {
  id:         string
  parent_id:  string | null
  role:       string
  content:    string | null
}

export interface TreeSummary {
  summary:   string
  openLoops: string[]
}

const SYSTEM = [
  'You write a short "where this stands" briefing for someone returning to a branching AI chat — a tree of messages where the user forks new branches to explore alternatives.',
  'Given the conversation, produce two things.',
  '(1) summary: 2-3 sentences, second person ("You were exploring..."), describing what this conversation is about and where it currently stands. Be concrete and specific to THIS conversation — no generic filler.',
  '(2) open_loops: up to 3 specific threads, questions, or directions that were raised but left unresolved or unexplored — the things genuinely worth picking back up. Each under 140 characters, phrased as a short, actionable nudge ("Compare the freemium option you never modeled"). If there are no real open loops, use an empty list.',
  'Reply with JSON only — no markdown fences. Format: {"summary": "...", "open_loops": ["...", "..."]}.',
].join(' ')

export async function generateTreeSummary(
  nodes: TreeNodeInput[],
): Promise<TreeSummary | null> {
  // Structural signal: how many branch points / branch tips, so the model can
  // reason about what was and wasn't pursued.
  const childCount = new Map<string, number>()
  for (const n of nodes) {
    if (n.parent_id) childCount.set(n.parent_id, (childCount.get(n.parent_id) ?? 0) + 1)
  }
  const branchPoints = [...childCount.values()].filter((c) => c >= 2).length
  const tips = nodes.filter((n) => !childCount.has(n.id)).length

  const transcript = nodes
    .map((n) => {
      const who = n.role === 'user' ? 'User' : 'AI'
      const text = (n.content ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS_PER_NODE)
      return text ? `${who}: ${text}` : ''
    })
    .filter(Boolean)
    .slice(-MAX_NODES_IN_PROMPT)
    .join('\n')

  if (!transcript) return null

  try {
    const { text } = await generateText({
      model:  anthropic(MODELS.haiku),
      system: SYSTEM,
      prompt:
        `This tree has ${nodes.length} messages, ${branchPoints} branch point(s), and ${tips} branch tip(s).\n\n` +
        `Conversation (oldest to newest):\n${transcript}`,
    })

    const clean = text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')

    const parsed  = JSON.parse(clean) as { summary?: unknown; open_loops?: unknown }
    const summary = String(parsed.summary ?? '').trim().slice(0, MAX_SUMMARY_LENGTH)
    if (!summary) return null

    const openLoops = (Array.isArray(parsed.open_loops) ? parsed.open_loops : [])
      .map((s) => String(s ?? '').trim())
      .filter((s) => s.length > 0 && s.length <= MAX_LOOP_LENGTH)
      .slice(0, MAX_OPEN_LOOPS)

    return { summary, openLoops }
  } catch (err) {
    console.warn('[tree-summary] generation failed', err)
    return null
  }
}
