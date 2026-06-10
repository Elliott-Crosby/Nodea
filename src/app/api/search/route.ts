import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: Request) {
  // Auth guard
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  const messageList = nodes
    .map((n, i) => `[${i}] (${n.role}) id:${n.id}\n${n.content.slice(0, 300)}`)
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
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'

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
