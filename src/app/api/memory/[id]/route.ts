import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isProUser } from '@/lib/plan'
import { MAX_MEMORY_LENGTH } from '@/lib/memory'

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<'/api/memory/[id]'>,
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Editing memories requires Pro — if you've downgraded, you can only delete.
  if (!(await isProUser(user.id, supabase))) {
    return Response.json({ error: 'pro_required' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { content } = (await req.json().catch(() => ({}))) as { content?: string }
  const trimmed = String(content ?? '').trim()
  if (!trimmed) {
    return Response.json({ error: 'empty' }, { status: 400 })
  }
  if (trimmed.length > MAX_MEMORY_LENGTH) {
    return Response.json({ error: 'too_long', max: MAX_MEMORY_LENGTH }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_memories')
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[memory:update]', error.code, error.message)
    return Response.json({ error: 'save_failed' }, { status: 500 })
  }
  return Response.json({ memory: data })
}

// Deletion is allowed for everyone (privacy) — even after downgrading from Pro.
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/memory/[id]'>,
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await ctx.params
  const { error } = await supabase
    .from('user_memories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[memory:delete]', error.code, error.message)
    return Response.json({ error: 'delete_failed' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
