import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import type { CollabInviteRow } from '@/lib/collab'

// ─────────────────────────────────────────────────────────────────────────────
// /api/collab/accept — POST { token }
//
// Opening an invite link mints a real membership row; from then on access
// flows from membership (RLS), never from the token. Runs with the service
// client because the acceptor has no RLS visibility into the space yet.
//
// Rules:
//   • expired or unknown token → 404/410
//   • email-bound invites only accept the matching account (case-insensitive)
//   • the space owner opening their own link is a no-op success
//   • email invites are single-use (deleted on accept); link invites stay
//     valid until they expire or are revoked, so one link can onboard a team
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabaseClient()
  if (!service) {
    console.error('[collab:accept] SUPABASE_SERVICE_ROLE_KEY not configured')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  const { token } = await req.json().catch(() => ({})) as { token?: string }
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 })
  }

  const { data: invite } = await service
    .from('collab_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle<CollabInviteRow>()

  if (!invite) return NextResponse.json({ error: 'invite_not_found' }, { status: 404 })
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'invite_expired' }, { status: 410 })
  }
  if (invite.email && invite.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'invite_email_mismatch' }, { status: 403 })
  }

  // Resolve the target space (also tells us if the acceptor is the owner).
  let target: { kind: 'conversation' | 'chat_project'; id: string; name: string; ownerId: string }
  if (invite.kind === 'conversation' && invite.project_id) {
    const { data: conv } = await service
      .from('projects')
      .select('id, name, user_id')
      .eq('id', invite.project_id)
      .maybeSingle()
    if (!conv) return NextResponse.json({ error: 'space_gone' }, { status: 410 })
    target = { kind: 'conversation', id: conv.id, name: conv.name, ownerId: conv.user_id }
  } else if (invite.kind === 'chat_project' && invite.chat_project_id) {
    const { data: cp } = await service
      .from('chat_projects')
      .select('id, name, user_id')
      .eq('id', invite.chat_project_id)
      .maybeSingle()
    if (!cp) return NextResponse.json({ error: 'space_gone' }, { status: 410 })
    target = { kind: 'chat_project', id: cp.id, name: cp.name, ownerId: cp.user_id }
  } else {
    return NextResponse.json({ error: 'invite_malformed' }, { status: 400 })
  }

  // Owner re-opening their own link: nothing to mint.
  if (target.ownerId !== user.id) {
    const row = target.kind === 'conversation'
      ? { project_id: target.id, user_id: user.id, invited_by: invite.invited_by }
      : { chat_project_id: target.id, user_id: user.id, invited_by: invite.invited_by }
    const table = target.kind === 'conversation' ? 'conversation_members' : 'chat_project_members'
    const { error: insErr } = await service.from(table).insert(row)
    // 23505 = already a member — fine, accepting twice is idempotent.
    if (insErr && insErr.code !== '23505') {
      console.error('[collab:accept] membership insert failed', insErr.code, insErr.message)
      return NextResponse.json({ error: 'accept_failed' }, { status: 500 })
    }
  }

  // Email-bound invites are single-use.
  if (invite.email) {
    await service.from('collab_invites').delete().eq('id', invite.id)
  }

  return NextResponse.json({
    ok: true,
    kind: target.kind,
    id: target.id,
    name: target.name,
    alreadyOwner: target.ownerId === user.id,
  })
}
