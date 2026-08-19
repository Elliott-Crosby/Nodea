// Last-chance campaign terms (Aug 18-25, 2026). Client-safe — no server imports.
//
// The absolute final run of discounted Pro: $12/mo, locked for the life of the
// subscription, 7 days, no seat cap. After the deadline the price is
// STANDARD_PRICE for good. The offer is REAL and enforced server-side:
// /api/stripe/checkout switches to the standard price the moment the deadline
// passes, and the $12 lock is persisted per-user as
// user_profiles.locked_price_id (see the 20260818120000 migration).
//
// LAST_CHANCE_PRICE must match the Stripe price behind
// STRIPE_PRICE_ID_LASTCHANCE (src/lib/lastChanceServer.ts) — the displayed
// figure and the eventual charge must never drift.

import { STANDARD_PRICE } from '@/lib/earlyBird'

export const LAST_CHANCE_PRICE = 12
export const LAST_CHANCE_START = '2026-08-18T00:00:00-07:00'
export const LAST_CHANCE_DEADLINE = '2026-08-25T23:59:59-07:00'
export const LAST_CHANCE_DISCOUNT_PCT = Math.round((1 - LAST_CHANCE_PRICE / STANDARD_PRICE) * 100)

/** True while the campaign should be advertised and honored. */
export function lastChanceActive(now: number = Date.now()): boolean {
  return (
    now >= new Date(LAST_CHANCE_START).getTime() &&
    now < new Date(LAST_CHANCE_DEADLINE).getTime()
  )
}

// ── Daily popup gating (client only) ─────────────────────────────────────────
// The popup re-shows once per calendar day (local time) until the deadline.
// Stores the local YYYY-MM-DD it was last seen; a new day → show again.
export const LAST_CHANCE_SEEN_DAY_KEY = 'nodea_last_chance_seen_day'

/** Local YYYY-MM-DD — 'en-CA' is the locale whose date format is ISO-shaped. */
export function localDayKey(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA')
}

/**
 * Whether the campaign popup wants this page load. Shared with the sibling
 * first-load popups (WhatsNewNotice) so they can stand down and never stack:
 * everyone reads this before anyone writes, and the seen-day is only written
 * on dismiss, so all callers agree within a single load.
 *
 * Storage-unavailable (private mode) → show; it just re-appears next visit,
 * same policy as WhatsNewNotice.
 */
export function lastChanceShowsToday(): boolean {
  if (!lastChanceActive()) return false
  try {
    return localStorage.getItem(LAST_CHANCE_SEEN_DAY_KEY) !== localDayKey()
  } catch {
    return true
  }
}
