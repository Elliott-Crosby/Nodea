'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function getSessionId(): string {
  const key = 'n_sid'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return ''
  }
}

export function PageTracker() {
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path:       pathname,
        referrer:   typeof document !== 'undefined' ? document.referrer : '',
        session_id: getSessionId(),
      }),
    }).catch(() => {})
  }, [pathname])

  return null
}
