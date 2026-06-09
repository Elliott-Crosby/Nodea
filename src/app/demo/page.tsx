import type { Metadata } from 'next'
import DemoApp from './DemoApp'

const TITLE = 'Try Nodea — Live Branching Chat Demo'
const DESC =
  'Try Nodea in your browser, no sign-up. A branching AI chat canvas: fork any reply and your conversation grows as a tree of branches, not one long thread.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/demo' },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: 'https://nodea.ai/demo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
  },
}

// Visually hidden so the interactive canvas keeps the full viewport, but the
// page still has a real H1 in the server HTML for crawlers and screen readers.
const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export default function DemoPage() {
  return (
    <>
      <h1 style={SR_ONLY}>Nodea AI — live branching AI chat canvas demo</h1>
      <DemoApp />
    </>
  )
}
