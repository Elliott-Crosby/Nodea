// Transactional email via Resend's REST API (no SDK dependency).
//
// Env:
//   RESEND_API_KEY     — required for anything to send; absent → no-op with a
//                        console warning, so email is never a hard dependency.
//   EMAIL_FROM         — verified sender, e.g. 'Nodea <notify@mail.nodea.ai>'.
//   ADMIN_NOTIFY_EMAIL — where founder/ops notifications go.
//
// Policy: code only ever sends operational email (founder notifications,
// receipts-style messages). Anything promotional must check
// user_profiles.marketing_opt_in — there is deliberately no bulk-send helper
// here.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

const FROM = () => process.env.EMAIL_FROM ?? 'Nodea <onboarding@resend.dev>'
const ADMIN_TO = () => process.env.ADMIN_NOTIFY_EMAIL ?? 'nodea.ai@gmail.com'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  replyTo?: string
}

export interface SendEmailResult {
  sent: boolean
  id?: string
  error?: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping send:', input.subject)
    return { sent: false, error: 'RESEND_API_KEY not set' }
  }
  try {
    const r = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM(),
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        ...(input.html ? { html: input.html } : {}),
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    })
    if (!r.ok) {
      const body = await r.text()
      console.error('[email] send failed:', r.status, body)
      return { sent: false, error: `HTTP ${r.status}` }
    }
    const j = (await r.json()) as { id?: string }
    return { sent: true, id: j.id }
  } catch (err) {
    console.error('[email] send threw:', err)
    return { sent: false, error: String(err) }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Founder/ops notification: plain, readable, no design. `lines` render as
// separate paragraphs; falsy lines are skipped so callers can inline
// conditionals.
export async function notifyAdmin(
  subject: string,
  lines: Array<string | null | undefined | false>,
): Promise<SendEmailResult> {
  const clean = lines.filter((l): l is string => typeof l === 'string' && l.length > 0)
  const text = clean.join('\n')
  const html = clean.map(l => `<p style="margin:0 0 10px;font:14px/1.5 -apple-system,Segoe UI,sans-serif">${escapeHtml(l)}</p>`).join('')
  return sendEmail({ to: ADMIN_TO(), subject, text, html })
}
