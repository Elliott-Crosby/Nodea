'use client'

import { useRef, useState } from 'react'

export default function FeedbackForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const submitting = useRef(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    const values = new FormData(form)
    submitting.current = true
    setStatus('sending')
    setError('')

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: values.get('message'),
          email: values.get('email'),
          website: values.get('website'),
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) {
        setError(response.status === 429
          ? 'Please wait a while before sending another message.'
          : 'Your message couldn’t be sent. Please try again or email nodea.ai@gmail.com.')
        setStatus('error')
        return
      }
      form.reset()
      setStatus('sent')
    } catch {
      setError('Your message couldn’t be sent. Please try again or email nodea.ai@gmail.com.')
      setStatus('error')
    } finally {
      submitting.current = false
    }
  }

  return (
    <div className="feedback">
      {status === 'sent' ? (
        <p role="status">Thank you. Your feedback has been received.</p>
      ) : (
        <form onSubmit={submit} aria-busy={status === 'sending'}>
          <label htmlFor="feedback-message">Anything you’d like to share?</label>
          <textarea id="feedback-message" name="message" rows={4} required maxLength={3000} disabled={status === 'sending'} />
          <label htmlFor="feedback-email">Your email (optional, if you’d like a reply)</label>
          <input id="feedback-email" name="email" type="email" autoComplete="email" maxLength={254} disabled={status === 'sending'} />
          <div className="feedback-trap" aria-hidden="true" inert>
            <label htmlFor="feedback-website">Leave this empty</label>
            <input id="feedback-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <p>Your feedback goes to Nodea. Please leave out sensitive information. <a href="/privacy">Privacy</a></p>
          {status === 'error' && <p role="alert">{error}</p>}
          <button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send feedback'}<span aria-hidden="true">↗</span></button>
        </form>
      )}
    </div>
  )
}
