// Early-bird (founding-member) offer terms. Client-safe — no server imports.
//
// The offer is REAL and enforced: seat count comes from live non-admin Pro
// profiles (see /api/early-bird), and checkout switches to the standard price
// once the cap is hit or the deadline passes (see /api/stripe/checkout).
// Keep the displayed claim and the enforcement in sync — never hardcode a
// seats-left number in UI copy.
export const EARLY_BIRD_SEATS = 10
export const EARLY_BIRD_DEADLINE = '2026-07-31T23:59:59-07:00'

export interface EarlyBirdStatus {
  /** Seats still available, or null if the count is unavailable. */
  remaining: number | null
  deadline: string
  /** True while the offer should be advertised and honored. */
  active: boolean
}
