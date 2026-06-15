import type { Metadata } from 'next'
import LandingContent from '../_components/landing/LandingContent'

// /home is an alias for the landing page, useful for logged-in users who want
// to get back to the marketing site without being bounced to the canvas.
// It is the same content as "/", so keep it out of the index and point the
// canonical at the real home to avoid duplicate-content penalties.
export const metadata: Metadata = {
  alternates: { canonical: 'https://nodea.ai/' },
  robots: { index: false, follow: true },
}

export default function HomeAlias() {
  return <LandingContent />
}
