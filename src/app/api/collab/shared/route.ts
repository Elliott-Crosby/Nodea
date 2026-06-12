import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { resolveProfiles } from '@/lib/collab'

// ─────────────────────────────────────────────────────────────────────────────
// /api/collab/shared — GET
//
// Everything shared WITH the current user, for the sidebar:
//   • conversations  — one-off chats they were invited to
//   • chatProjects   — team spaces they belong to (with chat counts + owner)
//   • projectConversations — the chats living inside those team spaces
//
// Own spaces never appear here; /api/projects and /api/chat-projects stay the
// source of truth for those (including their create-default behaviors).
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Membership rows are visible to their own user under RLS.
  const [{ data: convMemberships }, { data: projMemberships }] = await Promise.all([
    supabase.from('conversation_members').select('project_id').eq('user_id', user.id),
    supabase.from('chat_project_members').select('chat_project_id').eq('user_id', user.id),
  ])

  const sharedConvIds = (convMemberships ?? []).map((m) => m.project_id)
  const sharedProjectIds = (projMemberships ?? []).map((m) => m.chat_project_id)

  if (!sharedConvIds.length && !sharedProjectIds.length) {
    return NextResponse.json({ conversations: [], chatProjects: [], projectConversations: [] })
  }

  const [convRes, cpRes, cpConvRes] = await Promise.all([
    sharedConvIds.length
      ? supabase.from('projects').select('*').in('id', sharedConvIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    sharedProjectIds.length
      ? supabase.from('chat_projects').select('*').in('id', sharedProjectIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    sharedProjectIds.length
      ? supabase.from('projects').select('*').in('chat_project_id', sharedProjectIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const conversations = convRes.data ?? []
  const chatProjectRows = (cpRes.data ?? []) as { id: string; user_id: string; [k: string]: unknown }[]
  const projectConversations = (cpConvRes.data ?? []) as { chat_project_id: string | null; created_at: string }[]

  // Owner names ("Shared by …") — best effort; missing service key degrades
  // to plain rows.
  const service = createServiceSupabaseClient()
  const ownerProfiles = service
    ? await resolveProfiles(service, chatProjectRows.map((p) => p.user_id))
    : new Map<string, { display_name: string; email: string | null }>()

  const chatProjects = chatProjectRows.map((p) => {
    const inProject = projectConversations.filter((c) => c.chat_project_id === p.id)
    const last = inProject.reduce<string | null>(
      (acc, c) => (!acc || c.created_at > acc ? c.created_at : acc), null)
    return {
      ...p,
      chat_count: inProject.length,
      last_activity: last,
      shared: true,
      owner_name: ownerProfiles.get(p.user_id)?.display_name ?? null,
    }
  })

  return NextResponse.json({ conversations, chatProjects, projectConversations })
}
