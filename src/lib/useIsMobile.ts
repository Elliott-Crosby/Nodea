'use client'

import { useEffect, useState } from 'react'

// Mobile breakpoint — below this width we serve the touch-native mobile UI.
// Matches the design's intent: phones only, tablets/desktop keep the existing
// three-panel canvas untouched.
export const MOBILE_BREAKPOINT = 768

// SSR-safe viewport check. Returns false on the server and the first client
// render (so hydration matches the desktop markup), then flips to the real
// value after mount. The flash is acceptable — /app and /demo are client routes
// behind a loading state anyway.
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const update = () => setIsMobile(mql.matches)
    update()
    // Safari < 14 only supports addListener.
    if (mql.addEventListener) mql.addEventListener('change', update)
    else mql.addListener(update)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', update)
      else mql.removeListener(update)
    }
  }, [breakpoint])

  return isMobile
}
