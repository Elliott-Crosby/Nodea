import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import {
  canAccessConversation,
  canAccessChatProject,
  resolveProfiles,
  type MemberProfile,
} from '@/lib/collab'

// ─────────────────────────────────────────────────────────────────────────────
// /api/collab/members
// GET    — ?conversationId= | ?chatProjectId= → members (owner first) with
//          display names, plus pending invites for the share modal.
// DELETE — ?conversationId=&userId= | ?chatProjectId=&userId= → remove a
//          member (owner removes anyone; a member removes themself).
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabaseClient()
  if (!service) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })

  const url = new URL(req.url)
  const conversationId = url.searchParams.get('conversationId')
  const chatProjectId = url.searchParams.get('chatProjectId')
  if (!conversationId && !chatProjectId) {
    return NextResponse.json({ error: 'missing_target' }, { status: 400 })
  }

  let ownerId: string
  let memberRows: { user_id: string; created_at: string }[]
  if (conversationId) {
    if (!(await canAccessConversation(service, conversationId, user.id))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const { data: conv } = await service
      .from('projects').select('user_id').eq('id', conversationId).single()
    ownerId = conv!.user_id
    const { data } = await service
      .from('conversation_members')
      .select('user_id, created_at')
      .eq('project_id', conversationId)
      .order('created_at', { ascending: true })
    memberRows = data ?? []
  } else {
    if (!(await canAccessChatProject(service, chatProjectId!, user.id))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const { data: cp } = await service
      .from('chat_projects').select('user_id').eq('id', chatProjectId!).single()
    ownerId = cp!.user_id
    const { data } = await service
      .from('chat_project_members')
      .select('user_id, created_at')
      .eq('chat_project_id', chatProjectId!)
      .order('created_at', { ascending: true })
    memberRows = data ?? []
  }

  const profiles = await resolveProfiles(service, [ownerId, ...memberRows.map((m) => m.user_id)])
  const members: MemberProfile[] = [
    {
      user_id: ownerId,
      role: 'owner',
      display_name: profiles.get(ownerId)?.display_name ?? 'Owner',
      email: profiles.get(ownerId)?.email ?? null,
    },
    ...memberRows.map((m): MemberProfile => ({
      user_id: m.user_id,
      role: 'editor',
      display_name: profiles.get(m.user_id)?.display_name ?? 'Member',
      email: profiles.get(m.user_id)?.email ?? null,
    })),
  ]

  // Author profiles: every distinct created_by in this conversation's tree.
  // Needed because a conversation inside a shared Chat Project has authors who
  // are project members, not conversation members — the avatar chips still
  // need their names.
  let authors: MemberProfile[] = []
  if (conversationId) {
    const { data: authorRows } = await service
      .from('nodes')
      .select('created_by')
      .eq('project_id', conversationId)
      .not('created_by', 'is', null)
    const ids = [...new Set((authorRows ?? []).map((r) => r.created_by as string))]
      .filter((id) => id !== ownerId && !memberRows.some((m) => m.user_id === id))
    if (ids.length) {
      const authorProfiles = await resolveProfiles(service, ids)
      authors = ids.map((id): MemberProfile => ({
        user_id: id,
        role: 'editor',
        display_name: authorProfiles.get(id)?.display_name ?? 'Member',
        email: authorProfiles.get(id)?.email ?? null,
      }))
    }
  }

  // Pending invites — the caller's own RLS view (members may see them).
  const inviteQuery = supabase
    .from('collab_invites')
    .select('id, token, kind, email, created_at, expires_at')
    .gt('expires_at', new Date().toISOString())
  const { data: invites } = conversationId
    ? await inviteQuery.eq('project_id', conversationId)
    : await inviteQuery.eq('chat_project_id', chatProjectId!)

  return NextResponse.json({ members, authors, invites: invites ?? [], me: user.id })
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const conversationId = url.searchParams.get('conversationId')
  const chatProjectId = url.searchParams.get('chatProjectId')
  const userId = url.searchParams.get('userId')
  if (!userId || (!conversationId && !chatProjectId)) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  // The caller's own client: collab_delete_*_members policies allow exactly
  // "self leaves" or "owner removes anyone".
  const { error } = conversationId
    ? await supabase.from('conversation_members').delete()
        .eq('project_id', conversationId).eq('user_id', userId)
    : await supabase.from('chat_project_members').delete()
        .eq('chat_project_id', chatProjectId!).eq('user_id', userId)

  if (error) {
    console.error('[collab:member-delete]', error.code, error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
