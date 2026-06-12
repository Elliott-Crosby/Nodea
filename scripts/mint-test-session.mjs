// Dev-only helper: mint a session for the OWNER's account so automated
// verification can exercise the authenticated app against the live DB.
// Uses the service key from .env.local (admin.generateLink → verifyOtp);
// no password is involved. Prints { access_token, refresh_token }.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''),
    ]),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const email = process.argv[2]
if (!email) { console.error('usage: node mint-test-session.mjs <email>'); process.exit(1) }

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
if (linkErr) { console.error('generateLink failed:', linkErr.message); process.exit(1) }

const { data: sessionData, error: otpErr } = await anon.auth.verifyOtp({
  type: 'email',
  token_hash: linkData.properties.hashed_token,
})
if (otpErr || !sessionData.session) { console.error('verifyOtp failed:', otpErr?.message); process.exit(1) }

console.log(JSON.stringify({
  access_token: sessionData.session.access_token,
  refresh_token: sessionData.session.refresh_token,
}))
