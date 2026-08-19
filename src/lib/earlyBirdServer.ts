import { createServiceSupabaseClient } from '@/lib/supabase-server'
import {
  EARLY_BIRD_SEATS,
  EARLY_BIRD_DEADLINE,
  EARLY_BIRD_PRICE,
  STANDARD_PRICE,
  type EarlyBirdStatus,
} from '@/lib/earlyBird'
import {
  LAST_CHANCE_PRICE,
  LAST_CHANCE_DEADLINE,
  lastChanceActive,
} from '@/lib/lastChance'

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

  // The founding-seat offer ended 2026-07-31. Once it is over, the status this
  // function reports is whichever offer is CURRENTLY live — today that is the
  // last-chance campaign ($12/mo, time-boxed, no seat cap), then standard.
  // Same shape, so every consumer (upgrade page, in-app modal, checkout)
  // advertises exactly what checkout will charge.
  if (expired) {
    const active = lastChanceActive()
    return {
      remaining: null,
      deadline: LAST_CHANCE_DEADLINE,
      active,
      price: active ? LAST_CHANCE_PRICE : STANDARD_PRICE,
      offer: active ? 'last_chance' : 'standard',
    }
  }

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
    offer: active ? 'early_bird' : 'standard',
  }
}
