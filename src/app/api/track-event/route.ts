import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { clientIp, rateLimited } from '@/lib/request-limits'

export async function POST(req: Request) {
  try {
    // Unauthenticated service-role write — keep a flood backstop on it.
    if (rateLimited(`track:${clientIp(req)}`, 60, 60_000)) {
      return new Response('ok')
    }
    const { event_name, session_id, properties } = await req.json()
    // Cap the free-form properties payload so a single beacon can't store
    // arbitrarily large JSON.
    const props =
      properties && typeof properties === 'object' && JSON.stringify(properties).length <= 2_000
        ? properties
        : null
    const service = createServiceSupabaseClient()
    if (service) {
      await service.from('events').insert({
        event_name:  typeof event_name  === 'string' ? event_name.slice(0, 100)  : 'unknown',
        session_id:  typeof session_id  === 'string' ? session_id.slice(0, 64)   : null,
        properties:  props,
      })
    }
  } catch {
    // fire-and-forget
  }
  return new Response('ok')
}
