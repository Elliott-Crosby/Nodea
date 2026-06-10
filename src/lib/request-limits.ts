// Best-effort request limiting for public endpoints. The in-memory buckets are
// per warm serverless instance and reset on cold start — a backstop against
// casual abuse, not a guarantee. Anything that must hold globally needs a
// durable counter (Supabase/KV).

/**
 * Client IP from platform-set headers. On Vercel, x-vercel-forwarded-for and
 * x-real-ip are set by the platform and inbound spoofs are stripped; a bare
 * x-forwarded-for value is only trusted as a dev fallback (its leftmost entry
 * is client-suppliable behind other proxies).
 */
export function clientIp(req: Request): string {
  return (
    req.headers.get('x-vercel-forwarded-for')?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

const buckets = new Map<string, number[]>()

/** Sliding-window limiter: true when `key` exceeded `limit` hits per window. */
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  buckets.set(key, recent)
  // Drop stale buckets opportunistically so the map can't grow unbounded.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) buckets.delete(k)
    }
  }
  return recent.length > limit
}
