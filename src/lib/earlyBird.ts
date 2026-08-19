// Early-bird (founding-member) offer terms. Client-safe — no server imports.
//
// The offer is REAL and enforced: seat count comes from live non-admin Pro
// profiles (see /api/early-bird), and checkout switches to the standard price
// once the cap is hit or the deadline passes (see /api/stripe/checkout).
// Keep the displayed claim and the enforcement in sync — never hardcode a
// seats-left number in UI copy.
export const EARLY_BIRD_SEATS = 10
export const EARLY_BIRD_DEADLINE = '2026-07-31T23:59:59-07:00'

// Displayed prices. EARLY_BIRD_PRICE must match the Stripe product behind
// STRIPE_PRICE_ID; STANDARD_PRICE must match STRIPE_PRICE_ID_STANDARD (the
// price checkout switches to once the offer ends). The struck-through anchor
// and the "then Pro is $X/mo" countdown both read from these so the promise
// and the eventual charge stay in sync.
export const EARLY_BIRD_PRICE = 8
export const STANDARD_PRICE = 24
export const EARLY_BIRD_DISCOUNT_PCT = Math.round((1 - EARLY_BIRD_PRICE / STANDARD_PRICE) * 100)

export interface EarlyBirdStatus {
  /** Seats still available, or null if the count is unavailable. */
  remaining: number | null
  deadline: string
  /** True while the offer should be advertised and honored. */
  active: boolean
  /**
   * Which offer the price/deadline describe. 'early_bird' = the founding-seat
   * offer (seat-capped), 'last_chance' = the Aug 2026 $12 campaign (time-boxed
   * only), 'standard' = no offer running. Older cached responses may omit it.
   */
  offer?: 'early_bird' | 'last_chance' | 'standard'
  /**
   * Monthly price in dollars a NEW subscriber would be charged right now.
   * Every price shown next to an upgrade button should come from here so the
   * displayed figure can never drift from what checkout actually charges.
   *
   * Note: users with a durable rate lock (user_profiles.early_bird) are always
   * charged EARLY_BIRD_PRICE regardless of this value — see /api/stripe/checkout.
   * They may briefly see the standard price quoted; they are never charged it.
   */
  price: number
}
