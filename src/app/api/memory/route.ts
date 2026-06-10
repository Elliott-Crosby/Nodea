import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isProUser } from '@/lib/plan'
import { MAX_MEMORY_ENTRIES, MAX_MEMORY_LENGTH } from '@/lib/memory'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('user_memories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[memory:list]', error.code, error.message)
    return Response.json({ memories: [] })
  }
  return Response.json({ memories: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!(await isProUser(user.id, supabase))) {
    return Response.json({ error: 'pro_required' }, { status: 403 })
  }

  const { content } = (await req.json().catch(() => ({}))) as { content?: string }
  const trimmed = String(content ?? '').trim()
  if (!trimmed) {
    return Response.json({ error: 'empty' }, { status: 400 })
  }
  if (trimmed.length > MAX_MEMORY_LENGTH) {
    return Response.json({ error: 'too_long', max: MAX_MEMORY_LENGTH }, { status: 400 })
  }

  const { count } = await supabase
    .from('user_memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= MAX_MEMORY_ENTRIES) {
    return Response.json({ error: 'limit_reached', max: MAX_MEMORY_ENTRIES }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_memories')
    .insert({ user_id: user.id, content: trimmed, source: 'manual' })
    .select()
    .single()

  if (error) {
    console.error('[memory:insert]', error.code, error.message)
    return Response.json({ error: 'save_failed' }, { status: 500 })
  }
  return Response.json({ memory: data })
}
