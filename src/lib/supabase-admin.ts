import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return _client
}
