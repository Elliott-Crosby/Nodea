'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getSessionId } from '@/lib/track-event'

function sendDuration(id: number, startMs: number) {
  const duration_ms = Date.now() - startMs
  const blob = new Blob(
    [JSON.stringify({ id, duration_ms })],
    { type: 'application/json' },
  )
  navigator.sendBeacon('/api/track-duration', blob)
}

export function PageTracker() {
  const pathname  = usePathname()
  const startRef  = useRef<number>(Date.now())
  const rowIdRef  = useRef<number | null>(null)

  // On each route change: flush the previous page's duration, then record the new one
  useEffect(() => {
    const prevId = rowIdRef.current
    if (prevId !== null) {
      sendDuration(prevId, startRef.current)
      rowIdRef.current = null
    }

    startRef.current = Date.now()

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path:       pathname,
        referrer:   typeof document !== 'undefined' ? document.referrer : '',
        session_id: getSessionId(),
      }),
    })
      .then(r => r.json())
      .then(d => { if (typeof d?.id === 'number') rowIdRef.current = d.id })
      .catch(() => {})
  }, [pathname])

  // On tab hide (close, switch), beacon the duration for the current page
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden' && rowIdRef.current !== null) {
        sendDuration(rowIdRef.current, startRef.current)
        // Reset start so a second hide event doesn't double-count
        startRef.current = Date.now()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return null
}
