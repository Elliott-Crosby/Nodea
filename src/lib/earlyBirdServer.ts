import { createServiceSupabaseClient } from '@/lib/supabase-server'
import {
  EARLY_BIRD_SEATS,
  EARLY_BIRD_DEADLINE,
  EARLY_BIRD_PRICE,
  STANDARD_PRICE,
  type EarlyBirdStatus,
} from '@/lib/earlyBird'

/**
 * Live early-bird status. Seats taken = non-admin Pro profiles that carry a
 * stripe_customer_id — i.e. seats someone actually paid for. Admin grants,
 * comped accounts and legacy self-inserted 'pro' rows must not consume a
 * founding seat, or the page advertises scarcity that isn't real and the
 * offer ends early for genuine buyers. This mirrors the canonical Pro gate
 * in src/lib/plan.ts (isProUser).
 *
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
      .not('stripe_customer_id', 'is', null)
    if (!error && typeof count === 'number') {
      remaining = Math.max(0, EARLY_BIRD_SEATS - count)
    }
  }

  const active = !expired && (remaining === null || remaining > 0)

  return {
    remaining,
    deadline: EARLY_BIRD_DEADLINE,
    active,
    price: active ? EARLY_BIRD_PRICE : STANDARD_PRICE,
  }
}
