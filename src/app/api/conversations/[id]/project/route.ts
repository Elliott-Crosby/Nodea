import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isProUser } from '@/lib/chat-projects'

// ─────────────────────────────────────────────────────────────────────────────
// /api/conversations/[id]/project
// PATCH — set chat_project_id on a conversation (the legacy `projects` table).
//         Body: { chat_project_id: string | null }
//         null detaches the conversation from any project.
//
// Removing a conversation from a project is allowed for everyone. Assigning
// requires Pro — otherwise a downgraded user could keep filing chats into
// projects they should no longer be able to manage.
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    chat_project_id?: string | null
  }

  const target = body.chat_project_id === null
    ? null
    : body.chat_project_id === undefined
      ? undefined
      : String(body.chat_project_id)

  if (target === undefined) {
    return NextResponse.json({ error: 'chat_project_id_required' }, { status: 400 })
  }

  // Gating: only block *assigning* a project (target !== null) behind Pro.
  // Detaching is always allowed.
  if (target !== null) {
    if (!(await isProUser(user.id, supabase))) {
      return NextResponse.json({ error: 'pro_required' }, { status: 403 })
    }

    // Make sure the target project is owned by this user. Without this an
    // RLS-bypass would still fail, but the error would be opaque.
    const { data: proj } = await supabase
      .from('chat_projects')
      .select('id')
      .eq('id', target)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!proj) {
      return NextResponse.json({ error: 'project_not_found' }, { status: 404 })
    }
  }

  const { data, error } = await supabase
    .from('projects') // legacy table name = conversations
    .update({ chat_project_id: target })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, name, chat_project_id, created_at, user_id')
    .single()

  if (error) {
    console.error('[conv-project:update]', error.code, error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ conversation: data })
}
