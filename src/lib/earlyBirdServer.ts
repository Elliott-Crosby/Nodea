import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { EARLY_BIRD_SEATS, EARLY_BIRD_DEADLINE, type EarlyBirdStatus } from '@/lib/earlyBird'

/**
 * Live early-bird status. Seats taken = non-admin Pro profiles, so the
 * founder's own accounts don't consume (or fake-consume) seats.
 * Fails open on count errors (remaining: null) — callers should keep
 * advertising conservative and pricing generous in that case.
 */
export async function getEarlyBirdStatus(): Promise<EarlyBirdStatus> {
  const expired = Date.now() >= new Date(EARLY_BIRD_DEADLINE).getTime()

  let remaining: number | null = null
  const supabase = createServiceSupabaseClient()
  if (supabase) {
    const { count, error } = await supabase
      .from('user_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('plan', 'pro')
      .not('is_admin', 'is', true)
    if (!error && typeof count === 'number') {
      remaining = Math.max(0, EARLY_BIRD_SEATS - count)
    }
  }

  return {
    remaining,
    deadline: EARLY_BIRD_DEADLINE,
    active: !expired && (remaining === null || remaining > 0),
  }
}
