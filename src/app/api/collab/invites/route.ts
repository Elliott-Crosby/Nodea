import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { InviteKind } from '@/lib/collab'

// ─────────────────────────────────────────────────────────────────────────────
// /api/collab/invites
// POST   — create an invite for a conversation or a Chat Project. Returns the
//          /join/<token> link. RLS enforces that only someone with access to
//          the target space can create one (collab_insert_invites).
// DELETE — revoke an invite by id (?id=). RLS: creator or space owner.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    kind?: InviteKind
    conversationId?: string
    chatProjectId?: string
    email?: string
  }

  const kind: InviteKind | null =
    body.kind === 'conversation' || body.kind === 'chat_project' ? body.kind : null
  if (!kind) return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })

  const targetId = kind === 'conversation' ? body.conversationId : body.chatProjectId
  if (!targetId) return NextResponse.json({ error: 'missing_target' }, { status: 400 })

  const email = typeof body.email === 'string' && body.email.trim()
    ? body.email.trim().toLowerCase()
    : null
  if (email && !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const token = randomBytes(24).toString('base64url')

  // Insert with the caller's own client so the collab_insert_invites policy is
  // the access check — no duplicated authorization logic here.
  const { data: invite, error } = await supabase
    .from('collab_invites')
    .insert({
      token,
      kind,
      chat_project_id: kind === 'chat_project' ? targetId : null,
      project_id: kind === 'conversation' ? targetId : null,
      email,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) {
    // 42501 = RLS rejection → the caller has no access to that space.
    const status = error.code === '42501' ? 403 : 500
    if (status === 500) console.error('[collab:invite-create]', error.code, error.message)
    return NextResponse.json({ error: status === 403 ? 'forbidden' : 'create_failed' }, { status })
  }

  const origin = new URL(req.url).origin
  return NextResponse.json({
    invite,
    joinUrl: `${origin}/join/${token}`,
  })
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  // RLS (collab_delete_invites) limits this to the creator or the space owner.
  const { error } = await supabase.from('collab_invites').delete().eq('id', id)
  if (error) {
    console.error('[collab:invite-delete]', error.code, error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
