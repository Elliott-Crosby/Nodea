// Server-side last-chance campaign constants. Import only from server code.
//
// The Stripe price id for the $12/mo last-chance rate, created 2026-08-18 on
// the same product as the founding $8 price (prod_UYKsCDxcfGOgkS). Price ids
// are not secrets (they ride in checkout sessions and client metadata), so a
// hardcoded fallback is deliberate: the campaign must not silently sell the
// wrong price because an env var didn't make it to a deploy environment. The
// env var still wins so a rotated price never needs a code change.
export const LAST_CHANCE_PRICE_ID =
  process.env.STRIPE_PRICE_ID_LASTCHANCE ?? 'price_1U60AwGYiQNJnyUE09V3WfYS'
