import { createServiceSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { path, referrer, session_id } = await req.json()
    const service = createServiceSupabaseClient()
    if (service) {
      await service.from('page_views').insert({
        path:       typeof path       === 'string' ? path.slice(0, 512)       : '/',
        referrer:   typeof referrer   === 'string' ? referrer.slice(0, 512)   : null,
        session_id: typeof session_id === 'string' ? session_id.slice(0, 64)  : null,
      })
    }
  } catch {
    // fire-and-forget — never block the page
  }
  return new Response('ok')
}
