import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
} from '@/lib/supabase-server'
import {
  generateTreeSummary,
  TREE_SUMMARY_MIN_NODES,
  type TreeNodeInput,
} from '@/lib/tree-summary'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projects/[id]/summary
// Returns the "where this stands" summary + open loops for a conversation
// (tree), generating it with Haiku when missing or stale. Available to all
// users — this is a retention hook, not a Pro feature. Body: { force?: boolean }.
//
// Resilient to the summary_* columns not existing yet (pre-migration): in that
// case it simply skips caching and regenerates each time.
// ─────────────────────────────────────────────────────────────────────────────

interface ProjSummaryRow {
  summary:            string | null
  summary_open_loops: string[] | null
  summary_node_count: number | null
  summary_updated_at: string | null
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { force } = (await req.json().catch(() => ({}))) as { force?: boolean }

  // Ownership check (also confirms the conversation exists).
  const { data: owned } = await supabase
    .from('projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Cached summary — tolerate the columns not being migrated yet.
  let cached: ProjSummaryRow | null = null
  {
    const { data, error } = await supabase
      .from('projects')
      .select('summary, summary_open_loops, summary_node_count, summary_updated_at')
      .eq('id', id)
      .maybeSingle()
    if (!error) cached = data as ProjSummaryRow | null
  }

  // Load the tree's nodes.
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, parent_id, role, content, created_at')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  const list = (nodes ?? []) as Array<TreeNodeInput & { created_at: string }>
  if (list.length < TREE_SUMMARY_MIN_NODES) {
    return NextResponse.json({ summary: null, reason: 'too_small' })
  }

  // Cache hit: stored summary still matches the current node count.
  if (
    !force &&
    cached?.summary &&
    cached.summary_node_count === list.length
  ) {
    return NextResponse.json({
      summary:   cached.summary,
      openLoops: cached.summary_open_loops ?? [],
      updatedAt: cached.summary_updated_at,
      cached:    true,
    })
  }

  const result = await generateTreeSummary(list)
  if (!result) return NextResponse.json({ summary: null, reason: 'no_summary' })

  const updatedAt = new Date().toISOString()

  // Persist via service role (bypasses RLS, reliable server-side write).
  // Non-fatal: if the columns aren't migrated yet, the summary still returns.
  const writeClient = createServiceSupabaseClient() ?? supabase
  const { error: writeErr } = await writeClient
    .from('projects')
    .update({
      summary:            result.summary,
      summary_open_loops: result.openLoops,
      summary_node_count: list.length,
      summary_updated_at: updatedAt,
    })
    .eq('id', id)
  if (writeErr) console.warn('[tree-summary] persist skipped:', writeErr.message)

  return NextResponse.json({
    summary:   result.summary,
    openLoops: result.openLoops,
    updatedAt,
    cached:    false,
  })
}
