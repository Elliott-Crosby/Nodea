import type { SupabaseClient } from '@supabase/supabase-js'

const FREE_DAILY_LIMIT = 25_000
const PRO_DAILY_LIMIT  = 250_000
const GRACE_BUFFER     = 500
export const MAX_INPUT_TOKENS = 4_000

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface UsageRecord {
  user_id: string
  daily_tokens: number
  monthly_tokens: number   // kept for DB compat; not enforced
  total_tokens?: number
  daily_reset_at: string
  monthly_reset_at: string // kept for DB compat; not enforced
}

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

    if (code === '42703') continue

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
  limit_type: 'daily' | 'input_too_large'
  resets_at: string
  tokens_used: number
  tokens_limit: number
}

export type LimitCheck = { allowed: true } | RateLimitError

export async function checkTokenLimits(
  userId: string,
  estimatedInputTokens: number,
  supabase: SupabaseClient,
  admin = false,
  isPro = false,
): Promise<LimitCheck> {
  if (admin) return { allowed: true }

  const DAILY_LIMIT = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT

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

  const now   = new Date()
  const daily = now >= new Date(record.daily_reset_at) ? 0 : record.daily_tokens

  if (daily > DAILY_LIMIT + GRACE_BUFFER) {
    return {
      allowed: false,
      limit_type: 'daily',
      resets_at: record.daily_reset_at,
      tokens_used: daily,
      tokens_limit: DAILY_LIMIT,
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

  const dailyResetDue = now >= new Date(record.daily_reset_at)
  const newDaily        = dailyResetDue ? total : record.daily_tokens + total
  const newDailyResetAt = dailyResetDue ? nextMidnightUTC().toISOString() : record.daily_reset_at

  if (newDaily > FREE_DAILY_LIMIT) {
    console.warn(`[token-limits] daily overage user=${userId} used=${newDaily}/${FREE_DAILY_LIMIT}`)
  }

  const hasTotal = typeof record.total_tokens === 'number'
  const updatePayload: Record<string, unknown> = {
    daily_tokens:   newDaily,
    daily_reset_at: newDailyResetAt,
    ...(hasTotal ? { total_tokens: record.total_tokens! + total } : {}),
  }

  const { error: updateError } = await supabase
    .from('user_token_usage')
    .update(updatePayload)
    .eq('user_id', userId)

  if (updateError) {
    if (pgCode(updateError) === '42703' && hasTotal) {
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
