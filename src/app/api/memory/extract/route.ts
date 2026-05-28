import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import {
  MAX_MEMORY_ENTRIES,
  loadUserMemories,
  extractMemoriesFromExchange,
  dedupAgainstExisting,
} from '@/lib/memory'

async function isProUser(userId: string, supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  if (await isAdmin(userId, supabase)) return true
  const { data } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.plan === 'pro'
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!(await isProUser(user.id, supabase))) {
    // Free users get a silent no-op so the client doesn't need to branch on plan.
    return Response.json({ saved: [] })
  }

  const { userMessage, assistantReply } = (await req.json().catch(() => ({}))) as {
    userMessage?:   string
    assistantReply?: string
  }
  const u = String(userMessage ?? '').trim()
  const a = String(assistantReply ?? '').trim()
  if (!u || !a) return Response.json({ saved: [] })

  const existing = await loadUserMemories(user.id, supabase)
  if (existing.length >= MAX_MEMORY_ENTRIES) {
    // At cap — skip extraction. User can prune in Settings to make room.
    return Response.json({ saved: [], capped: true })
  }

  const candidates = await extractMemoriesFromExchange(u, a, existing)
  const fresh      = dedupAgainstExisting(candidates, existing)
  if (fresh.length === 0) return Response.json({ saved: [] })

  const room    = MAX_MEMORY_ENTRIES - existing.length
  const toWrite = fresh.slice(0, room)

  const { data, error } = await supabase
    .from('user_memories')
    .insert(toWrite.map((content) => ({ user_id: user.id, content, source: 'auto' as const })))
    .select()

  if (error) {
    console.error('[memory:extract]', error.code, error.message)
    return Response.json({ saved: [] })
  }
  return Response.json({ saved: (data ?? []).map((m) => m.content) })
}
