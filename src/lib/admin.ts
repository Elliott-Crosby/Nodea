import type { SupabaseClient } from '@supabase/supabase-js'

// Permanent admin accounts — bypass all limits even before the DB migration runs.
const HARDCODED_ADMINS = new Set(['64b415d7-4b59-4ff1-aa35-5f88de1599de'])

/**
 * Returns true if the given user has is_admin = true in user_profiles,
 * or is in the hardcoded admin set.
 * Fails closed — any DB error falls back to the hardcoded list only.
 */
export async function isAdmin(userId: string, supabase: SupabaseClient): Promise<boolean> {
  if (HARDCODED_ADMINS.has(userId)) return true

  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return false
  return data.is_admin === true
}
