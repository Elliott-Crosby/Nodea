import type { SupabaseClient, User } from '@supabase/supabase-js'

// ─── Collaboration server helpers ────────────────────────────────────────────
// Shared by the /api/collab/* routes. Access checks lean on the same membership
// model the RLS policies enforce (migration 20260612000000_collaboration) —
// these run with the service client only where the caller's own RLS view
// isn't enough (accepting an invite, resolving member profiles).

export type InviteKind = 'chat_project' | 'conversation'

export interface CollabInviteRow {
  id: string
  token: string
  kind: InviteKind
  chat_project_id: string | null
  project_id: string | null
  email: string | null
  role: string
  invited_by: string
  created_at: string
  expires_at: string
}

export interface MemberProfile {
  user_id: string
  display_name: string
  email: string | null
  role: 'owner' | 'editor'
}

/** Whether `userId` may access the conversation: owner, direct member, or
 *  member of the Chat Project it's filed under. Service-client query (the
 *  caller's identity is already verified by the route). */
export async function canAccessConversation(
  service: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const { data: proj } = await service
    .from('projects')
    .select('user_id, chat_project_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!proj) return false
  if (proj.user_id === userId) return true

  const { data: direct } = await service
    .from('conversation_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  if (direct) return true

  if (proj.chat_project_id) {
    const { data: viaProject } = await service
      .from('chat_project_members')
      .select('user_id')
      .eq('chat_project_id', proj.chat_project_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (viaProject) return true
  }
  return false
}

/** Whether `userId` may access the Chat Project: owner or member. */
export async function canAccessChatProject(
  service: SupabaseClient,
  chatProjectId: string,
  userId: string,
): Promise<boolean> {
  const { data: cp } = await service
    .from('chat_projects')
    .select('user_id')
    .eq('id', chatProjectId)
    .maybeSingle()
  if (!cp) return false
  if (cp.user_id === userId) return true
  const { data: member } = await service
    .from('chat_project_members')
    .select('user_id')
    .eq('chat_project_id', chatProjectId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!member
}

/** Resolve display profiles for a set of user ids via the Auth admin API.
 *  Display names come from user_metadata.display_name (set on /welcome). */
export async function resolveProfiles(
  service: SupabaseClient,
  userIds: string[],
): Promise<Map<string, { display_name: string; email: string | null }>> {
  const out = new Map<string, { display_name: string; email: string | null }>()
  await Promise.all(
    [...new Set(userIds)].map(async (id) => {
      try {
        const { data, error } = await service.auth.admin.getUserById(id)
        if (error || !data.user) return
        out.set(id, profileFromUser(data.user))
      } catch {
        // Skip unresolvable users (deleted accounts) — caller falls back.
      }
    }),
  )
  return out
}

export function profileFromUser(u: User): { display_name: string; email: string | null } {
  const meta = (u.user_metadata ?? {}) as { display_name?: unknown }
  const name = typeof meta.display_name === 'string' && meta.display_name.trim()
    ? meta.display_name.trim()
    : (u.email?.split('@')[0] ?? 'Member')
  return { display_name: name, email: u.email ?? null }
}
