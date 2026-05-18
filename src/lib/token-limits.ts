/*
 * SQL migration required — see supabase/migrations/20260517000000_token_limits.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const DAILY_LIMIT   = 10_000
const MONTHLY_LIMIT = 125_000
const GRACE_BUFFER  = 500
export const MAX_INPUT_TOKENS = 4_000

// ~4 chars per token — rough pre-check estimate only
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface UsageRecord {
  user_id: string
  daily_tokens: number
  monthly_tokens: number
  daily_reset_at: string
  monthly_reset_at: string
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
  const { data: existing } = await supabase
    .from('user_token_usage')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing as UsageRecord

  const record = {
    user_id:          userId,
    daily_tokens:     0,
    monthly_tokens:   0,
    daily_reset_at:   nextMidnightUTC().toISOString(),
    monthly_reset_at: nextMonthUTC().toISOString(),
  }

  const { data, error } = await supabase
    .from('user_token_usage')
    .insert(record)
    .select()
    .single()

  if (error) {
    // Race: another concurrent request already inserted — re-fetch
    const { data: refetched } = await supabase
      .from('user_token_usage')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (refetched) return refetched as UsageRecord
    throw error
  }

  return data as UsageRecord
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
    // Table not yet created or other transient error — fail open so chat still works.
    console.warn('[token-limits] checkTokenLimits skipped:', err)
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
    console.warn('[token-limits] recordTokenUsage skipped:', err)
    return
  }

  const dailyResetDue    = now >= new Date(record.daily_reset_at)
  const monthlyResetDue  = now >= new Date(record.monthly_reset_at)

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

  await supabase
    .from('user_token_usage')
    .update({
      daily_tokens:     newDaily,
      monthly_tokens:   newMonthly,
      daily_reset_at:   newDailyResetAt,
      monthly_reset_at: newMonthlyResetAt,
    })
    .eq('user_id', userId)
}
