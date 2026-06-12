// ── Canonical display timezone for the entire site ───────────────────────────
//
// Every user-facing wall-clock timestamp (chat message times, usage-limit reset
// times, conversation "last activity" dates) is rendered in US Eastern so it
// matches the operator's clock rather than the viewer's local zone. This is the
// ONE place the zone is hardcoded — import SITE_TZ (or these helpers) everywhere
// a moment-in-time is shown to a user.
//
// America/New_York is the DST-aware IANA zone for "EST" (EST in winter, EDT in
// summer); a fixed "EST"/"-05:00" would be an hour off for half the year.
//
// NOTE: this intentionally does NOT cover editorial date-only values (e.g. blog
// publishedAt like '2026-05-22'). Those parse as midnight UTC; pinning them to
// Eastern would shift the displayed day backward. They render as authored.
export const SITE_TZ = 'America/New_York'

// Time-of-day in Eastern, e.g. "02:57 PM". Pass extra Intl options to extend
// (e.g. { timeZoneName: 'short' } to append "EST"/"EDT").
export function formatSiteTime(
  value: number | string | Date,
  opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  return new Date(value).toLocaleTimeString('en-US', { timeZone: SITE_TZ, ...opts })
}

// Calendar date in Eastern, e.g. "Jun 12". Defaults to the locale's short date;
// pass options (e.g. { month: 'short', day: 'numeric' }) to shape it.
export function formatSiteDate(
  value: number | string | Date,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  return new Date(value).toLocaleDateString('en-US', { timeZone: SITE_TZ, ...opts })
}
