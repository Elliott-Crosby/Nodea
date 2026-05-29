import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  isProUser,
  VALID_COLOR_IDS,
  VALID_ICON_KEYS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_PINNED_PROJECTS,
} from '@/lib/chat-projects'

// ─────────────────────────────────────────────────────────────────────────────
// /api/chat-projects/[id]
// PATCH  — update a chat_project. Pro only.
// DELETE — remove a chat_project. ?deleteConversations=1 also drops the
//          conversations (and their nodes) that lived inside it; default is
//          to keep the conversations but unparent them (ON DELETE SET NULL).
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

  if (!(await isProUser(user.id, supabase))) {
    return NextResponse.json({ error: 'pro_required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Partial<{
    name: string
    description: string
    icon: string
    color: string
    pinned: boolean
  }>

  const updates: Record<string, string | boolean> = {}

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 })
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: 'name_too_long', max: MAX_NAME_LENGTH }, { status: 400 })
    }
    updates.name = name
  }

  if (body.description !== undefined) {
    const description = String(body.description).trim()
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: 'description_too_long', max: MAX_DESCRIPTION_LENGTH }, { status: 400 })
    }
    updates.description = description
  }

  if (body.icon !== undefined) {
    const icon = String(body.icon)
    if (!VALID_ICON_KEYS.has(icon)) {
      return NextResponse.json({ error: 'invalid_icon' }, { status: 400 })
    }
    updates.icon = icon
  }

  if (body.color !== undefined) {
    const color = String(body.color)
    if (!VALID_COLOR_IDS.has(color)) {
      return NextResponse.json({ error: 'invalid_color' }, { status: 400 })
    }
    updates.color = color
  }

  if (body.pinned !== undefined) {
    if (body.pinned === true) {
      // Enforce the pin cap server-side. If the target is already pinned the
      // count check still passes — we only block fresh pins beyond the cap.
      const { data: existing } = await supabase
        .from('chat_projects')
        .select('pinned')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!existing) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      if (!existing.pinned) {
        const { count: pinnedCount } = await supabase
          .from('chat_projects')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('pinned', true)
        if ((pinnedCount ?? 0) >= MAX_PINNED_PROJECTS) {
          return NextResponse.json(
            { error: 'pin_limit', max: MAX_PINNED_PROJECTS },
            { status: 400 },
          )
        }
      }
    }
    updates.pinned = body.pinned
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('chat_projects')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[chat-projects:update]', error.code, error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ project: data })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pro gating: even free users who somehow ended up with a project (downgrade)
  // can delete one — we only block creation/editing. Deletes are always allowed.

  const url = new URL(req.url)
  const deleteConvs = url.searchParams.get('deleteConversations') === '1'
    || url.searchParams.get('deleteConversations') === 'true'

  // Confirm ownership up front so we return a clean 404 rather than letting
  // RLS silently swallow the operation.
  const { data: project } = await supabase
    .from('chat_projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!project) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (deleteConvs) {
    // Look up the affected conversation ids first so we can also drop their
    // nodes — Postgres `ON DELETE CASCADE` between projects→nodes already
    // handles that, but we run an explicit delete anyway to be safe under
    // schemas where the cascade hasn't been confirmed.
    const { data: affected } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id)
      .eq('chat_project_id', id)
    const convIds = (affected ?? []).map((r: { id: string }) => r.id)

    if (convIds.length > 0) {
      await supabase.from('nodes').delete().in('project_id', convIds)
      await supabase.from('projects').delete().in('id', convIds)
    }
  }
  // Either way, FK ON DELETE SET NULL unparents any conversations that
  // remain (i.e. the "keep conversations" path).

  const { error } = await supabase
    .from('chat_projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[chat-projects:delete]', error.code, error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deletedConversations: deleteConvs })
}
