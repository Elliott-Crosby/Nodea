import { generateText } from 'ai'
import { anthropic } from '@/lib/anthropic'
import { MODELS } from '@/lib/models'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Presentation-mode callout summarizer. Takes 1–8 prompt/answer excerpts from
// selected tree nodes and returns one plain-text takeaway capped at 200 chars
// (the callout card's hard limit). Haiku keeps it fast and cheap.

const MAX_ITEMS      = 8
const MAX_PROMPT_IN  = 500
const MAX_ANSWER_IN  = 1200
const CALLOUT_MAX    = 200

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { items?: { prompt?: string; answer?: string }[] }
  try { body = await req.json() } catch { return new Response('Bad Request', { status: 400 }) }

  const items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : []
  if (items.length === 0) return new Response('Bad Request', { status: 400 })

  const excerpts = items
    .map((it, i) => {
      const prompt = String(it.prompt ?? '').slice(0, MAX_PROMPT_IN)
      const answer = String(it.answer ?? '').slice(0, MAX_ANSWER_IN)
      return `[Node ${i + 1}]\nQuestion: ${prompt}\nAnswer: ${answer}`
    })
    .join('\n\n')

  const single = items.length === 1
  const system =
    'You write callout annotations for a presentation slide showing an AI conversation tree. ' +
    `Reply with ONLY the callout text: plain English, no quotes, no markdown, no preamble, max 180 characters. ` +
    (single
      ? 'Capture the single most important takeaway from the exchange.'
      : 'Capture the one collective insight that ties the selected exchanges together (e.g. what was compared, decided, or concluded across them).')

  try {
    const { text } = await generateText({
      model:  anthropic(MODELS.haiku),
      system,
      prompt: excerpts,
    })
    let clean = text
      .trim()
      .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '')
      .replace(/\s+/g, ' ')
    if (clean.length > CALLOUT_MAX) {
      // Cut at a word boundary so the cap never slices mid-word.
      const cut = clean.slice(0, CALLOUT_MAX - 1)
      const sp  = cut.lastIndexOf(' ')
      clean = (sp > CALLOUT_MAX * 0.6 ? cut.slice(0, sp) : cut) + '…'
    }
    return Response.json({ text: clean })
  } catch {
    return new Response('Summarize failed', { status: 502 })
  }
}
