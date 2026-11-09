import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { MAX_MEMORY_ENTRIES, MAX_MEMORY_LENGTH } from '@/lib/memory'

// Bulk memory import (paste from Claude / ChatGPT) + the prompt-state read the
// first-load popup keys off. The profile stamp (memory_imported_at) is a
// server-only column, hence the service-role write here rather than a client
// upsert. POST with an empty array = "nothing to import" — stamps done
// without saving, so the popup stops re-asking.

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabaseClient()
  if (!service) return Response.json({ error: 'Service client unavailable' }, { status: 500 })

  const { data: profile } = await service
    .from('user_profiles')
    .select('memory_imported_at, use_cases')
    .eq('user_id', user.id)
    .maybeSingle()

  return Response.json({
    imported: !!profile?.memory_imported_at,
    // The use-case survey popup owns the first slot; the memory prompt waits
    // until it's answered so modals never stack.
    surveyPending: !profile || profile.use_cases === null,
  })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabaseClient()
  if (!service) return Response.json({ error: 'Service client unavailable' }, { status: 500 })

  let body: { lines?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!Array.isArray(body.lines)) {
    return Response.json({ error: 'lines must be an array' }, { status: 400 })
  }

  const lines = body.lines
    .filter((l): l is string => typeof l === 'string')
    .map(l => l.trim().slice(0, MAX_MEMORY_LENGTH))
    .filter(l => l.length >= 3)
    .slice(0, MAX_MEMORY_ENTRIES)

  let imported = 0
  if (lines.length > 0) {
    const { count } = await service
      .from('user_memories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const room = MAX_MEMORY_ENTRIES - (count ?? 0)
    if (room <= 0) return Response.json({ error: 'limit_reached' }, { status: 400 })

    const rows = lines.slice(0, room).map(content => ({
      user_id: user.id,
      content,
      source: 'manual' as const,
    }))
    const { error } = await service.from('user_memories').insert(rows)
    if (error) {
      console.error('[memory-import] insert failed:', error.code, error.message)
      return Response.json({ error: 'save_failed' }, { status: 500 })
    }
    imported = rows.length
  }

  const { error: stampErr } = await service
    .from('user_profiles')
    .upsert({ user_id: user.id, memory_imported_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (stampErr) {
    console.error('[memory-import] stamp failed:', stampErr.code, stampErr.message)
  }

  return Response.json({ imported })
}
