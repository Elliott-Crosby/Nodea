import { generateText } from 'ai'
import { anthropic } from '@/lib/anthropic'
import { MODELS } from '@/lib/models'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Strip wrapping quotes / trailing punctuation / "Title:" prefixes that small
// models sometimes add despite being told not to.
function cleanTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '')
    .replace(/^(?:title|conversation|topic)\s*[:\-—]\s*/i, '')
    .replace(/[.。!?]+$/, '')
    .trim()
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { userPrompt, aiResponse, type } = await req.json() as {
    userPrompt: string
    aiResponse?: string
    type: 'conversation' | 'node'
  }

  if (type === 'conversation') {
    const { text } = await generateText({
      model: anthropic(MODELS.haiku),
      system: 'Generate an ultra-short title (max 30 chars) for a conversation based on the user\'s first message. Reply with ONLY the title — no quotes, no punctuation at end, no explanation.',
      prompt: userPrompt.slice(0, 500),
    })
    return Response.json({ title: cleanTitle(text).slice(0, 30) })
  }

  if (type === 'node') {
    const { text } = await generateText({
      model: anthropic(MODELS.haiku),
      system: 'Generate compact node labels for a conversation tree UI. Reply with JSON only — no markdown fences, no explanation. Format: {"title":"...","summary":"..."}. Rules: title is max 35 chars summarising the user\'s question; summary is max 110 chars capturing the key takeaway from the AI\'s answer in plain English.',
      prompt: `User: ${userPrompt.slice(0, 300)}\n\nAI: ${(aiResponse ?? '').slice(0, 600)}`,
    })
    try {
      const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
      const parsed = JSON.parse(clean)
      return Response.json({
        title:   String(parsed.title   ?? '').slice(0, 35),
        summary: String(parsed.summary ?? '').slice(0, 110),
      })
    } catch {
      return Response.json({ title: userPrompt.slice(0, 35), summary: '' })
    }
  }

  return new Response('Bad Request', { status: 400 })
}
