import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import type { PostgrestError } from '@supabase/supabase-js'

/**
 * GET /api/debug-usage
 *
 * Admin-only diagnostic — open in browser to see exactly why token usage
 * tracking might be failing.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({
      status: 'unauthenticated',
      authError: authError ? { message: authError.message } : null,
    })
  }

  if (!(await isAdmin(user.id, supabase))) {
    return new Response('Not found', { status: 404 })
  }

  function fmtPgErr(e: PostgrestError | null) {
    if (!e) return null
    return { code: e.code, message: e.message, details: e.details, hint: e.hint }
  }

  // Check table existence and row
  const { data: row, error: selectError } = await supabase
    .from('user_token_usage')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Test write permission (no-op update)
  let writeError: ReturnType<typeof fmtPgErr> = null
  if (row) {
    const { error: we } = await supabase
      .from('user_token_usage')
      .update({ daily_tokens: (row as { daily_tokens: number }).daily_tokens })
      .eq('user_id', user.id)
    writeError = fmtPgErr(we)
  }

  return Response.json({
    userId: user.id,
    email:  user.email,
    table: {
      exists:      !selectError,
      hasRow:      !!row,
      row:         row ?? null,
      selectError: fmtPgErr(selectError),
    },
    write: {
      tested:     !!row,
      writeError,
    },
    env: {
      supabaseUrl:    !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey:        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      anthropicKey:   !!process.env.ANTHROPIC_API_KEY,
    },
  })
}
