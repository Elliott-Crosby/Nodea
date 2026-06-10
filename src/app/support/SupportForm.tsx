'use client'

import { useState } from 'react'

// Public Formspree endpoint (account: nodea.ai@gmail.com). It's a NEXT_PUBLIC
// value that's visible client-side anyway, so we ship a working default and
// allow an override via env if the form ever moves.
const ENDPOINT =
  process.env.NEXT_PUBLIC_CONTACT_FORM_ENDPOINT ?? 'https://formspree.io/f/meedgzgn'

export default function SupportForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [form, setForm] = useState({ email: '', subject: '', message: '' })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...form,
          // Helps tell Nodea messages apart from other forms in the shared inbox.
          _subject: `Nodea support — ${form.subject || 'New message'}`,
          site: 'nodea.ai',
        }),
      })
      if (res.ok) {
        setStatus('sent')
        setForm({ email: '', subject: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="ln-form-status ok" role="status">
        Thanks, your message is on its way. We&rsquo;ll reply to your email,
        usually within 1–2 business days.
      </div>
    )
  }

  return (
    <form className="ln-form" onSubmit={handleSubmit}>
      <div className="ln-field">
        <label className="ln-label" htmlFor="email">Your email</label>
        <input
          className="ln-input"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@example.com"
        />
      </div>

      <div className="ln-field">
        <label className="ln-label" htmlFor="subject">Subject</label>
        <input
          className="ln-input"
          id="subject"
          name="subject"
          type="text"
          required
          value={form.subject}
          onChange={handleChange}
          placeholder="Billing, a bug, a feature request…"
        />
      </div>

      <div className="ln-field">
        <label className="ln-label" htmlFor="message">Message</label>
        <textarea
          className="ln-textarea"
          id="message"
          name="message"
          rows={6}
          required
          value={form.message}
          onChange={handleChange}
          placeholder="Tell us what's going on. Include your account email if it differs from above, plus steps to reproduce a bug if that's what you're reporting."
        />
      </div>

      {status === 'error' && (
        <div className="ln-form-status err" role="alert">
          Something went wrong sending that. Please email us directly at{' '}
          <a href="mailto:nodea.ai@gmail.com">nodea.ai@gmail.com</a>.
        </div>
      )}

      <button
        className="ln-btn ln-btn-primary ln-btn-lg"
        type="submit"
        disabled={status === 'sending'}
        style={{ alignSelf: 'flex-start' }}
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
