import { createServiceSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { id, duration_ms } = await req.json()
    if (typeof id !== 'number' || typeof duration_ms !== 'number' || duration_ms < 0) {
      return new Response('ok')
    }
    const service = createServiceSupabaseClient()
    if (service) {
      await service
        .from('page_views')
        .update({ duration_ms: Math.min(duration_ms, 86_400_000) }) // cap at 24h
        .eq('id', id)
        .is('duration_ms', null) // only set once — first beacon wins
    }
  } catch {
    // fire-and-forget
  }
  return new Response('ok')
}
