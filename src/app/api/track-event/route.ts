import { createServiceSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { event_name, session_id, properties } = await req.json()
    const service = createServiceSupabaseClient()
    if (service) {
      await service.from('events').insert({
        event_name:  typeof event_name  === 'string' ? event_name.slice(0, 100)  : 'unknown',
        session_id:  typeof session_id  === 'string' ? session_id.slice(0, 64)   : null,
        properties:  properties && typeof properties === 'object' ? properties : null,
      })
    }
  } catch {
    // fire-and-forget
  }
  return new Response('ok')
}
