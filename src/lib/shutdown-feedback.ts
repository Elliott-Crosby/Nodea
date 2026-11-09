import { createHash, createHmac } from 'node:crypto'

const MAX_BYTES = 16_384
const WINDOW = 60 * 60 * 1000
const buckets = new Map<string, { count: number; expires: number }>()

// A bounded, per-instance backstop. The database enforces the shared limit.
function limited(ip: string) {
  const now = Date.now()
  for (const [key, value] of buckets) {
    if (value.expires <= now) buckets.delete(key)
  }
  const key = createHash('sha256').update(ip).digest('hex')
  if (!buckets.has(key) && buckets.size >= 5000) return true
  const current = buckets.get(key) ?? { count: 0, expires: now + WINDOW }
  current.count += 1
  buckets.set(key, current)
  const global = buckets.get('all') ?? { count: 0, expires: now + WINDOW }
  global.count += 1
  buckets.set('all', global)
  return current.count > 5 || global.count > 100
}

function reply(status: number, error?: string) {
  return Response.json(error ? { error } : { received: true }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(status === 429 ? { 'Retry-After': '3600' } : {}),
    },
  })
}

async function boundedBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('empty')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        await reader.cancel()
        throw new Error('large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export async function collectFeedback(request: Request) {
  // Compare the actual URL, never a caller-supplied forwarded-host header.
  if (request.headers.get('origin') !== new URL(request.url).origin ||
      !['same-origin', null].includes(request.headers.get('sec-fetch-site'))) {
    return reply(403, 'Please use the feedback form on this site.')
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return reply(415, 'Expected JSON.')
  }
  const size = request.headers.get('content-length')
  if (size && (!/^\d+$/.test(size) || Number(size) > MAX_BYTES)) {
    return reply(413, 'Message too large.')
  }
  // Only platform-overwritten IP headers are trusted in production.
  const ip = process.env.VERCEL
    ? request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
    : 'local'
  if (limited(ip)) return reply(429, 'Please try again later.')

  let data: unknown
  try {
    data = await boundedBody(request)
  } catch (error) {
    return reply(error instanceof Error && error.message === 'large' ? 413 : 400, 'Invalid message.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, 'Invalid message.')
  const { message, email = '', website = '' } = data as Record<string, unknown>
  if (typeof website !== 'string' || website !== '') return reply(400, 'Invalid message.')
  if (typeof message !== 'string' || !message.trim() || message.length > 3000 ||
      typeof email !== 'string' || email.length > 254 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message) ||
      (email !== '' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) {
    return reply(400, 'Please check your message and email.')
  }

  try {
    const database = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!database || !serviceKey) {
      return reply(503, 'Feedback is temporarily unavailable.')
    }
    // Store feedback durably. The service-only function also rate-limits across
    // all server instances; neither public nor signed-in clients can call it.
    const result = await fetch(new URL('/rest/v1/rpc/collect_shutdown_feedback', database), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_message: message.trim(),
        p_email: email || null,
        p_client_hash: createHmac('sha256', serviceKey).update(ip).digest('hex'),
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      cache: 'no-store',
    })
    // Never acknowledge success unless the collector confirms acceptance.
    if (!result.ok) return reply(502, 'Feedback could not be received.')
    const accepted: unknown = await result.json()
    if (accepted && typeof accepted === 'object' && 'rate_limited' in accepted && accepted.rate_limited === true) {
      return reply(429, 'Please try again later.')
    }
    if (!accepted || typeof accepted !== 'object' || !('received' in accepted) || accepted.received !== true) {
      return reply(502, 'Feedback could not be received.')
    }
    return reply(200)
  } catch {
    // Do not log submitted text, email addresses, or provider responses.
    return reply(502, 'Feedback could not be received.')
  }
}
