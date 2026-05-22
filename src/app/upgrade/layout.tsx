import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — Free & Pro Plans',
  description:
    'Nodea is free during beta with a 25k daily token limit. Pro is $8/month: unlocks Claude Opus, 250k daily tokens, and early access to new features. Cancel anytime.',
  alternates: { canonical: '/upgrade' },
  openGraph: {
    title: 'Pricing — Nodea',
    description: 'Free with generous limits. Pro is $8/mo for Claude Opus and 10× the daily tokens.',
    url: 'https://nodea.ai/upgrade',
  },
}

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children
}
