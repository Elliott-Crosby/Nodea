import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

/**
 * Server-side Pro gate — the single source of truth for plan checks.
 *
 * Admins are always Pro. For everyone else the profile must say plan='pro'
 * AND carry a stripe_customer_id: every legitimate Pro grant comes from the
 * Stripe webhook, which always records the customer id. A 'pro' row without
 * one is forged (the old user_profiles INSERT policy let users insert their
 * own row — see migration 20260610120000) and must not unlock anything.
 *
 * Pass `knownAdmin` when the caller has already resolved isAdmin() to avoid
 * a duplicate profile lookup on hot paths.
 */
export async function isProUser(
  userId: string,
  supabase: SupabaseClient,
  knownAdmin?: boolean,
): Promise<boolean> {
  if (knownAdmin ?? (await isAdmin(userId, supabase))) return true
  const { data } = await supabase
    .from('user_profiles')
    .select('plan, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.plan === 'pro' && !!data.stripe_customer_id
}
