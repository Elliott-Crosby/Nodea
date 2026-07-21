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
}
