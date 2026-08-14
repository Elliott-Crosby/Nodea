'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { CHROME_STORE_URL } from '@/lib/links'

// Slim top-of-page announcement for the Chrome Web Store launch. Dismissible and
// remembered in localStorage so it doesn't nag on every visit. Renders nothing on
// the server / first paint to avoid a hydration flash, then appears on mount.
const DISMISS_KEY = 'nodea-announce-ext-v2'

export default function AnnounceBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== '1') setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <div className="ln-announce" role="region" aria-label="Announcement">
      <Link href="/extension" className="ln-announce-msg">
        <span className="ln-announce-tag">New</span>
        <span className="ln-announce-text">
          <strong>Nodea Tree</strong>{' '}
          now maps Claude, ChatGPT &amp; Gemini &mdash; see any chat as a branching tree.
        </span>
      </Link>
      <a
        href={CHROME_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="ln-announce-cta"
      >
        Add to Chrome &mdash; Free &rarr;
      </a>
      <button
        type="button"
        className="ln-announce-close"
        aria-label="Dismiss announcement"
        onClick={() => {
          setShow(false)
          try {
            localStorage.setItem(DISMISS_KEY, '1')
          } catch {
            /* ignore */
          }
        }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
