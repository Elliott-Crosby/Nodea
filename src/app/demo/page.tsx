import type { Metadata } from 'next'
import DemoApp from './DemoApp'

const TITLE = 'Try Nodea — Live Branching Chat Demo'
const DESC =
  'Play with Nodea right in your browser, no sign-up. Nodea is a branching AI chat canvas — fork any reply and your conversation grows as a tree of branches, not one long thread.'

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

export default function DemoPage() {
  return <DemoApp />
}
