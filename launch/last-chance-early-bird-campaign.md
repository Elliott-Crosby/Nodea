# Last Chance Forever — Early-Bird Revival Campaign (MODELED, NOT LIVE)

> **Status: planned.** Nothing here is deployed. The survey that feeds it ships
> first; this campaign launches ~2 days later once answers have accumulated.
> Founder go/no-go required before any step below runs.

## The offer

One final week of the $8/mo early-bird rate, then $24/mo standard — forever.
This is a **revival**, not an extension people were promised: the original
offer expired 2026-07-31 and the $24 cutover is already live. "Last chance
forever" is honest only if we mean it — after this window closes, the $8 rate
must never be offered again. Grandfathered `early_bird` users keep $8 for life
regardless (`EARLY_BIRD_PRICE = 8` and the checkout lock are untouched).

## Timeline

| Date | What happens |
|---|---|
| 2026-08-06 (done) | $24 stragglers live; survey feature built |
| 2026-08-06/07 | Survey deployed (migration first!) — answers accumulate |
| **2026-08-08** | Campaign go/no-go. If go: deadline bump deploys, popup ships, email sends |
| **2026-08-15 23:59 PT** | Offer closes for good — `active` flips false automatically |

## Code changes at launch (small, one commit)

1. **`src/lib/earlyBird.ts`** — `EARLY_BIRD_DEADLINE = '2026-08-15T23:59:59-07:00'`.
   Everything else derives: `/api/early-bird` flips `active: true`, the upgrade
   page automatically shows $8 with the struck-through $24 + EARLY BIRD badge +
   countdown, and checkout charges the early-bird price again. **Do not touch
   `EARLY_BIRD_PRICE` or `STANDARD_PRICE`.**
2. **Seat cap sanity** — `EARLY_BIRD_SEATS = 10` with 3 non-admin Pro profiles
   counted → "7 of 10 seats" reads believably; leave as is unless the founder
   wants a fresh cap for the revival week.
3. **`LastChanceModal`** in `/app` (free users only, once per user, localStorage-
   dismissable, suppressed while other modals are up — same pattern as the
   survey popup). Headline personalized by the user's stored `use_cases` (see
   below). CTA → `/upgrade`. Track `last_chance_shown` / `last_chance_clicked`.
4. **SettingsModal Memory upsell** — currently hardcodes `$STANDARD_PRICE/mo`;
   during the revival week it should quote the live offer price (fetch
   `/api/early-bird` or thread `price` through context) so the app never
   advertises $24 while checkout charges $8.

## Survey-driven personalization (the point of the survey)

Popup + email headline variants keyed off `user_profiles.use_cases`
(pick the user's first/most distinctive segment; fall back to generic):

| Segment key | Popup headline angle |
|---|---|
| `school` | "Lock in $8/mo before the semester does its thing — student budgets deserve the old price." |
| `writing` | "Every draft branch you'll ever explore — $8/mo if you grab it this week." |
| `coding` | "Opus on tap for $8/mo — the rate goes to $24 after Friday." |
| `research` | "Deep dives shouldn't cost deep pockets. Last week of $8/mo." |
| `work` | "Your decision trees, $8/mo forever — before it's $24 for everyone else." |
| `brainstorming` / `personal` / other / no answer | Generic: "Last chance, forever: $8/mo locked for life. $24 after [date]." |

Rules: honest scarcity only (real deadline, real seat count from
`/api/early-bird` — never a hardcoded number), no fake urgency after close,
and the rate lock promise mirrors the durable `early_bird` flag.

## Email

- Draft: `launch/email-last-chance-early-bird.html` (self-contained,
  email-safe tables + inline CSS, no images, no logo — wordmark as styled text).
- Audience: signups without an active Pro sub (~80 people). Send manually
  (BCC batches from the shared inbox) — no ESP is wired up, volume doesn't
  justify one this week.
- Subject candidates:
  1. `Last chance, forever — $8/mo Nodea Pro ends Friday`
  2. `The early-bird rate comes back for one week (then never again)`
  3. `$8 → $24 on Friday. Lock yours first.`
- Segment personalization: swap the one bolded line in the body per the table
  above once survey data exists; the draft ships with the generic line.

## Measurement

- `use_case_survey_saved` counts by source (welcome / app_popup / settings)
- `last_chance_shown` → `last_chance_clicked` → checkout conversion
- The check that matters afterward: the **first live $24 charge** post-window
  (the 2026-08-04 gap purchase means a real $24 checkout has still never been
  observed — verify the next one charges 2400).

## Open questions for the founder

1. Revive at exactly $8, or a middle rate (e.g. $12) to protect the "early
   bird meant early" promise to the original cohort?
2. Does the revival week re-grant the durable `early_bird` lock (current
   checkout behavior: yes, via metadata) — or should revival buyers lock at
   their price without the "founding member" label?
3. Email everyone, or exclude users who signed up in the last 48h (they just
   saw $24 pricing — a sudden $8 email may read as bait)?
