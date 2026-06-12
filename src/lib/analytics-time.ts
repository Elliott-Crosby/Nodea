// Timezone-aware day bucketing for admin analytics.
// Buckets are calendar days in the viewer's timezone, not UTC, so an evening
// pageview doesn't roll into the next UTC day and shift every block.

import { SITE_TZ } from './site-time'

const DEFAULT_TZ = 'UTC'

// Canonical timezone for the admin analytics dashboard — the same US Eastern zone
// the rest of the site renders in (see SITE_TZ). The whole dashboard
// (signup/conversation/project buckets, "today"/"this week" boundaries, event
// timestamps) is reported here so the numbers match the operator's wall clock
// rather than UTC.
export const ADMIN_TZ = SITE_TZ

// Validate an IANA timezone string; fall back to UTC if unusable.
export function resolveTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_TZ
  }
}

// Calendar day (YYYY-MM-DD) of an instant as seen in `tz`.
export function dayInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// tz wall-clock minus UTC, in ms, for the given instant (DST-aware).
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const m: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') m[p.type] = parseInt(p.value, 10)
  const asUtc = Date.UTC(m.year, m.month - 1, m.day, m.hour === 24 ? 0 : m.hour, m.minute, m.second)
  return asUtc - date.getTime()
}

// UTC instant of 00:00 local time on the given calendar day in `tz`.
function tzMidnightUtc(dayStr: string, tz: string): Date {
  const approx = new Date(dayStr + 'T00:00:00Z')
  const offset = tzOffsetMs(approx, tz)
  return new Date(approx.getTime() - offset)
}

// Ordered map of the last `days` calendar days in `tz`, each initialized to 0.
export function buildDayMap(days: number, tz: string): Map<string, number> {
  const map = new Map<string, number>()
  const today = dayInTz(new Date(), tz)
  const cursor = new Date(today + 'T00:00:00Z') // pure calendar counter
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setUTCDate(d.getUTCDate() - i)
    map.set(d.toISOString().slice(0, 10), 0)
  }
  return map
}

// UTC instant marking the start of the earliest day in a `days`-long window in `tz`.
export function windowStartUtc(days: number, tz: string): Date {
  const today = dayInTz(new Date(), tz)
  const cursor = new Date(today + 'T00:00:00Z')
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1))
  return tzMidnightUtc(cursor.toISOString().slice(0, 10), tz)
}

// UTC instant marking the start of today in `tz`.
export function todayStartUtc(tz: string): Date {
  return tzMidnightUtc(dayInTz(new Date(), tz), tz)
}

// Bucket a list of timestamps into the last `days` calendar days in `tz`.
// Timestamps outside the window are ignored.
export function bucketByDay(
  dates: Array<string | Date>,
  days: number,
  tz: string,
): Array<{ day: string; count: number }> {
  const map = buildDayMap(days, tz)
  for (const d of dates) {
    const day = dayInTz(typeof d === 'string' ? new Date(d) : d, tz)
    if (map.has(day)) map.set(day, map.get(day)! + 1)
  }
  return Array.from(map, ([day, count]) => ({ day, count }))
}
