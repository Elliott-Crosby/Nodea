import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@/lib/anthropic'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MODELS } from '@/lib/models'
import { rateLimited } from '@/lib/request-limits'
import { stripAttachmentMarker } from '@/lib/conversation-export'

// Model call against a whole conversation can take a few seconds; keep the
// function alive long enough to finish.
export const maxDuration = 30

export async function POST(req: Request) {
  // Auth guard
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Per-user flood backstop: model-backed and not metered against the token
  // budget, so cap loop rate.
  if (rateLimited(`search:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
  }

  const { query, projectId } = await req.json()
  if (!query?.trim() || !projectId) {
    return NextResponse.json({ error: 'Missing query or projectId' }, { status: 400 })
  }

  // Ownership check — projectId is client-supplied. RLS scopes the nodes
  // query too, but verify explicitly like the sibling project routes do.
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch all nodes for this project
  const { data: nodes, error } = await supabase
    .from('nodes')
    .select('id, role, content, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error || !nodes?.length) {
    return NextResponse.json({ results: [] })
  }

  // Build a compact message list for Claude to analyze
  // Strip the inline attachment marker before truncating: for an attachment-
  // bearing user node the marker + JSON header is prefixed before the real text,
  // so an un-stripped slice(0,300) would feed Claude the marker (which can leak
  // into the excerpt) and push the user's actual words out of the window.
  const messageList = nodes
    .map((n, i) => `[${i}] (${n.role}) id:${n.id}\n${stripAttachmentMarker(n.content).slice(0, 300)}`)
    .join('\n\n---\n\n')

  const prompt = `You are a semantic search engine for a conversation history.
The user is searching for: "${query}"

Below are all the messages in the conversation. Find the ones most conceptually or semantically relevant to the search query — not just exact keyword matches, but messages that relate to the same idea, topic, or theme.

Return a JSON array (no other text) of up to 8 most relevant results, each with:
- "id": the exact id string from the message
- "excerpt": a short excerpt (max 100 chars) from the message that shows relevance
- "reason": a 5-8 word phrase explaining why it's relevant

If nothing is relevant, return [].

Messages:
${messageList}`

  try {
    // Use the shared AI SDK provider (correct baseURL) — the raw Anthropic SDK
    // reads ANTHROPIC_BASE_URL from the environment, which is set without the
    // "/v1" segment for that SDK and made every concept search fail silently.
    const { text: raw } = await generateText({
      model: anthropic(MODELS.haiku),
      prompt,
      maxOutputTokens: 1024,
    })

    // Extract JSON from response (strip any markdown fences)
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    // Enrich results with role from original nodes
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const results = parsed
      .filter((r: { id: string }) => nodeMap.has(r.id))
      .map((r: { id: string; excerpt: string; reason: string }) => ({
        id: r.id,
        role: nodeMap.get(r.id)!.role,
        content: nodeMap.get(r.id)!.content,
        excerpt: r.excerpt,
        reason: r.reason,
      }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[search] Claude error:', err)
    return NextResponse.json({ results: [] })
  }
}
