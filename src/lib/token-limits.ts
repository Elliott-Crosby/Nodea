/*
 * SQL migration required — see supabase/migrations/20260517000000_token_limits.sql
 *
 * If total_tokens column is not yet present, daily/monthly tracking still works;
 * the all-time counter stays at 0 until the column is added.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const DAILY_LIMIT   = 10_000
const MONTHLY_LIMIT = 125_000
const GRACE_BUFFER  = 500
export const MAX_INPUT_TOKENS = 4_000

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface UsageRecord {
  user_id: string
  daily_tokens: number
  monthly_tokens: number
  total_tokens?: number   // optional — column may not exist yet if migration not applied
  daily_reset_at: string
  monthly_reset_at: string
}

// Supabase PostgREST errors have these fields; using a local interface avoids
// casting to Record<string,unknown> which TypeScript rejects.
interface PgError { code?: string; message?: string; details?: string; hint?: string }

function pgCode(err: unknown): string | undefined {
  return (err as PgError)?.code
}

function logErr(tag: string, err: unknown) {
  const e = err as PgError
  console.error(`[token-limits] ${tag}:`, e?.code, e?.message, e?.details ?? '')
}

function nextMidnightUTC(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1))
}

function nextMonthUTC(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1))
}

async function getOrCreateUsageRecord(userId: string, supabase: SupabaseClient): Promise<UsageRecord> {
  const { data: existing, error: selectErr } = await supabase
    .from('user_token_usage')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (selectErr) logErr('SELECT failed', selectErr)
  if (existing) return existing as UsageRecord

  // No row yet — insert one. Try with total_tokens first; fall back without it
  // in case the column hasn't been added via migration yet.
  const baseRecord = {
    user_id:          userId,
    daily_tokens:     0,
    monthly_tokens:   0,
    daily_reset_at:   nextMidnightUTC().toISOString(),
    monthly_reset_at: nextMonthUTC().toISOString(),
  }

  for (const payload of [
    { ...baseRecord, total_tokens: 0 },
    baseRecord,
  ]) {
    const { data, error } = await supabase
      .from('user_token_usage')
      .insert(payload)
      .select()
      .single()

    if (!error && data) return data as UsageRecord

    const code = pgCode(error)

    // 42703 = undefined_column (total_tokens not migrated yet) — retry without it
    if (code === '42703') continue

    // 23505 = unique_violation (race: another request beat us) — re-fetch
    if (code === '23505') {
      const { data: refetched } = await supabase
        .from('user_token_usage')
        .select('*')
        .eq('user_id', userId)
        .single()
      if (refetched) return refetched as UsageRecord
    }

    logErr('INSERT failed', error)
    throw error
  }

  // Both insert attempts failed — last chance fetch
  const { data: lastFetch, error: lastErr } = await supabase
    .from('user_token_usage')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (lastFetch) return lastFetch as UsageRecord
  throw lastErr ?? new Error('getOrCreateUsageRecord: could not insert or fetch row')
}

export type RateLimitError = {
  allowed: false
  limit_type: 'daily' | 'monthly' | 'input_too_large'
  resets_at: string
  tokens_used: number
  tokens_limit: number
}

export type LimitCheck = { allowed: true } | RateLimitError

export async function checkTokenLimits(
  userId: string,
  estimatedInputTokens: number,
  supabase: SupabaseClient,
): Promise<LimitCheck> {
  if (estimatedInputTokens > MAX_INPUT_TOKENS) {
    return {
      allowed: false,
      limit_type: 'input_too_large',
      resets_at: new Date().toISOString(),
      tokens_used: estimatedInputTokens,
      tokens_limit: MAX_INPUT_TOKENS,
    }
  }

  let record: UsageRecord
  try {
    record = await getOrCreateUsageRecord(userId, supabase)
  } catch (err) {
    logErr('checkTokenLimits skipped', err)
    return { allowed: true }
  }

  const now     = new Date()
  const daily   = now >= new Date(record.daily_reset_at)   ? 0 : record.daily_tokens
  const monthly = now >= new Date(record.monthly_reset_at) ? 0 : record.monthly_tokens

  if (daily > DAILY_LIMIT + GRACE_BUFFER) {
    return {
      allowed: false,
      limit_type: 'daily',
      resets_at: record.daily_reset_at,
      tokens_used: daily,
      tokens_limit: DAILY_LIMIT,
    }
  }

  if (monthly > MONTHLY_LIMIT + GRACE_BUFFER) {
    return {
      allowed: false,
      limit_type: 'monthly',
      resets_at: record.monthly_reset_at,
      tokens_used: monthly,
      tokens_limit: MONTHLY_LIMIT,
    }
  }

  return { allowed: true }
}

export async function recordTokenUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number,
  supabase: SupabaseClient,
): Promise<void> {
  const total = inputTokens + outputTokens
  const now   = new Date()

  let record: UsageRecord
  try {
    record = await getOrCreateUsageRecord(userId, supabase)
  } catch (err) {
    logErr('recordTokenUsage skipped', err)
    return
  }

  const dailyResetDue   = now >= new Date(record.daily_reset_at)
  const monthlyResetDue = now >= new Date(record.monthly_reset_at)

  const newDaily          = dailyResetDue   ? total : record.daily_tokens   + total
  const newMonthly        = monthlyResetDue ? total : record.monthly_tokens + total
  const newDailyResetAt   = dailyResetDue   ? nextMidnightUTC().toISOString() : record.daily_reset_at
  const newMonthlyResetAt = monthlyResetDue ? nextMonthUTC().toISOString()    : record.monthly_reset_at

  if (newDaily > DAILY_LIMIT) {
    console.warn(`[token-limits] daily overage user=${userId} used=${newDaily}/${DAILY_LIMIT}`)
  }
  if (newMonthly >= MONTHLY_LIMIT * 0.8) {
    console.warn(`[token-limits] 80% monthly user=${userId} used=${newMonthly}/${MONTHLY_LIMIT}`)
  }

  // Include total_tokens only if the column already exists in the DB
  // (indicated by whether the fetched record contains the field).
  const hasTotal = typeof record.total_tokens === 'number'
  const updatePayload: Record<string, unknown> = {
    daily_tokens:     newDaily,
    monthly_tokens:   newMonthly,
    daily_reset_at:   newDailyResetAt,
    monthly_reset_at: newMonthlyResetAt,
    ...(hasTotal ? { total_tokens: record.total_tokens! + total } : {}),
  }

  const { error: updateError } = await supabase
    .from('user_token_usage')
    .update(updatePayload)
    .eq('user_id', userId)

  if (updateError) {
    if (pgCode(updateError) === '42703' && hasTotal) {
      // total_tokens column not yet migrated — retry without it
      console.warn('[token-limits] total_tokens column missing, retrying without it')
      const fallback = { ...updatePayload }
      delete fallback['total_tokens']
      const { error: retryErr } = await supabase
        .from('user_token_usage')
        .update(fallback)
        .eq('user_id', userId)
      if (retryErr) logErr('UPDATE retry failed', retryErr)
    } else {
      logErr('UPDATE failed', updateError)
    }
  }
}
