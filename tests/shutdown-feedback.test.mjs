import test from 'node:test'
import assert from 'node:assert/strict'

let sequence = 0
async function handler(t, transport) {
  const originalFetch = globalThis.fetch
  const originalEnv = { ...process.env }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  delete process.env.VERCEL
  globalThis.fetch = transport ?? (() => { throw new Error('Unexpected database write') })
  t.after(() => { globalThis.fetch = originalFetch; process.env = originalEnv })
  return (await import('../src/lib/shutdown-feedback.ts?test=' + ++sequence)).collectFeedback
}

function request(body, headers = {}, raw = false) {
  return new Request('https://nodea.ai/api/feedback', {
    method: 'POST',
    headers: { origin: 'https://nodea.ai', 'content-type': 'application/json', ...headers },
    body: raw ? body : JSON.stringify(body),
  })
}

test('cross-site and non-JSON requests cannot write feedback', async t => {
  const collect = await handler(t)
  assert.equal((await collect(request({ message: 'Hello' }, { origin: 'https://attacker.example' }))).status, 403)
  assert.equal((await collect(request({ message: 'Hello' }, { 'sec-fetch-site': 'cross-site' }))).status, 403)
  assert.equal((await collect(request({}, { 'content-type': 'text/plain' }))).status, 415)
})

test('rejects malformed, oversized and bot submissions before persistence', async t => {
  const collect = await handler(t)
  assert.equal((await collect(request('not json', {}, true))).status, 400)
  assert.equal((await collect(request({ message: 'Hi', website: 'spam' }))).status, 400)
  assert.equal((await collect(request({ message: 'Hi', email: 'bad\r\nemail' }))).status, 400)
  assert.equal((await collect(request('x'.repeat(16385), {}, true))).status, 413)
})

test('only acknowledges persisted feedback and sends no raw IP to storage', async t => {
  let stored
  const collect = await handler(t, async (url, options) => {
    assert.equal(url.href, 'https://database.example/rest/v1/rpc/collect_shutdown_feedback')
    assert.equal(options.headers.Authorization, 'Bearer test-service-key')
    stored = JSON.parse(options.body)
    return Response.json({ received: true })
  })
  const result = await collect(request({ message: '  Thank you <script>test</script>  ', email: '' }))
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { received: true })
  assert.equal(stored.p_message, 'Thank you <script>test</script>')
  assert.equal(stored.p_email, null)
  assert.match(stored.p_client_hash, /^[a-f0-9]{64}$/)
  assert.equal(result.headers.get('cache-control'), 'no-store')
})

test('database failures never produce a success response', async t => {
  const collect = await handler(t, async () => Response.json({ error: 'Unavailable' }, { status: 500 }))
  assert.equal((await collect(request({ message: 'Keep this message' }))).status, 502)
})

test('shared database limit is surfaced as a retryable error', async t => {
  const collect = await handler(t, async () => Response.json({ rate_limited: true }))
  const result = await collect(request({ message: 'Hello' }))
  assert.equal(result.status, 429)
  assert.equal(result.headers.get('retry-after'), '3600')
})

test('local abuse backstop caps requests even when callers spoof forwarded headers', async t => {
  let writes = 0
  const collect = await handler(t, async () => { writes++; return Response.json({ received: true }) })
  for (let i = 0; i < 5; i++) {
    assert.equal((await collect(request({ message: 'Hello' }, { 'x-forwarded-for': '192.0.2.' + i }))).status, 200)
  }
  assert.equal((await collect(request({ message: 'Hello' }, { 'x-forwarded-for': '198.51.100.1' }))).status, 429)
  assert.equal(writes, 5)
})
