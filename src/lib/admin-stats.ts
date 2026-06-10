import type { SupabaseClient } from '@supabase/supabase-js'

// Shared data access for the admin analytics dashboard. Centralizes the rules
// the dashboard depends on so the server component and the API routes stay in
// sync:
//   • Admin accounts are excluded from every headline number.
//   • Signups come from auth.users (the source of truth) — most free users
//     never get a user_profiles row, so counting profiles undercounts badly.
//   • Token windows are read from the live reset timestamps so stale counters
//     from inactive users don't inflate "today"/"this month".

// Permanent admin accounts — mirrors HARDCODED_ADMINS in src/lib/admin.ts.
const HARDCODED_ADMINS = ['64b415d7-4b59-4ff1-aa35-5f88de1599de']

export interface AuthUserLite {
  id: string
  email: string | null
  created_at: string
  is_anonymous: boolean
}

export interface TokenRow {
  user_id: string
  daily_tokens: number | null
  monthly_tokens: number | null
  total_tokens: number | null
  daily_reset_at: string | null
  monthly_reset_at: string | null
}

export interface ProfileRow {
  user_id: string
  plan: string | null
  is_admin: boolean | null
  stripe_customer_id: string | null
}

// Every admin user id: the hardcoded set plus anyone flagged is_admin in the DB.
export async function getAdminUserIds(service: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>(HARDCODED_ADMINS)
  const { data } = await service
    .from('user_profiles')
    .select('user_id')
    .eq('is_admin', true)
  for (const r of data ?? []) ids.add(r.user_id as string)
  return ids
}

// All auth users, paged through. GoTrue may cap perPage below what we request,
// so we never infer "last page" from the requested size — we page until a page
// comes back empty. (A hard cap guards against an unexpected non-terminating
// response.) is_anonymous lets us separate real signups from anonymous sessions.
export async function listAllAuthUsers(service: SupabaseClient): Promise<AuthUserLite[]> {
  const PER = 1000
  const MAX_PAGES = 10_000
  const out: AuthUserLite[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: PER })
    const users = data?.users ?? []
    if (error || users.length === 0) break
    for (const u of users) {
      out.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        is_anonymous: (u as { is_anonymous?: boolean }).is_anonymous ?? false,
      })
    }
  }
  return out
}

// Real signups = every auth user that isn't anonymous and isn't an admin.
export function realSignups(users: AuthUserLite[], adminIds: Set<string>): AuthUserLite[] {
  return users.filter(u => !u.is_anonymous && !adminIds.has(u.id))
}

// All token-usage rows, paged past PostgREST's default 1000-row cap.
export async function getAllTokenRows(service: SupabaseClient): Promise<TokenRow[]> {
  const PAGE = 1000
  const rows: TokenRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service
      .from('user_token_usage')
      .select('user_id, daily_tokens, monthly_tokens, total_tokens, daily_reset_at, monthly_reset_at')
      .order('user_id')
      .range(from, from + PAGE - 1)
    if (error || !data?.length) break
    rows.push(...(data as TokenRow[]))
    if (data.length < PAGE) break
  }
  return rows
}

// Token totals, excluding admins. "today" and "month" only count rows whose
// reset boundary is still in the future — a row whose daily_reset_at has already
// passed holds a stale value from a previous day (it resets to 0 lazily on the
// user's next message), so summing it raw inflates the current-window totals.
export function summarizeTokens(
  rows: TokenRow[],
  adminIds: Set<string>,
  now: Date = new Date(),
): { all: number; today: number; month: number } {
  let all = 0
  let today = 0
  let month = 0
  for (const r of rows) {
    if (adminIds.has(r.user_id)) continue
    all += r.total_tokens ?? 0
    if (r.daily_reset_at && new Date(r.daily_reset_at) > now) today += r.daily_tokens ?? 0
    if (r.monthly_reset_at && new Date(r.monthly_reset_at) > now) month += r.monthly_tokens ?? 0
  }
  return { all, today, month }
}

// PostgREST `in` list for a set of UUIDs, e.g. "(id1,id2)". Returns null when
// the set is empty so callers can skip the filter (an empty `in ()` is invalid).
export function notInList(ids: Set<string>): string | null {
  if (ids.size === 0) return null
  return `(${[...ids].join(',')})`
}

// Paged fetch of created_at timestamps from a user-owned table, excluding rows
// owned by admins. Pages past the 1000-row cap so day-buckets aren't truncated.
export async function fetchCreatedAtExcludingAdmins(
  service: SupabaseClient,
  table: 'projects' | 'chat_projects',
  sinceIso: string,
  adminFilter: string | null,
): Promise<string[]> {
  const PAGE = 1000
  const out: string[] = []
  for (let from = 0; ; from += PAGE) {
    let q = service
      .from(table)
      .select('created_at')
      .gte('created_at', sinceIso)
      .order('created_at')
      .range(from, from + PAGE - 1)
    if (adminFilter) q = q.not('user_id', 'in', adminFilter)
    const { data, error } = await q
    if (error || !data?.length) break
    out.push(...data.map(r => r.created_at as string))
    if (data.length < PAGE) break
  }
  return out
}

// Exact count of rows in a user-owned table, excluding admin-owned rows.
export async function countExcludingAdmins(
  service: SupabaseClient,
  table: 'projects' | 'chat_projects',
  adminFilter: string | null,
): Promise<number> {
  let q = service.from(table).select('*', { count: 'exact', head: true })
  if (adminFilter) q = q.not('user_id', 'in', adminFilter)
  const { count } = await q
  return count ?? 0
}
