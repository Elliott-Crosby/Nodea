import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in to Nodea',
  description: 'Sign in to Nodea — branching AI chat canvas. Free during beta. Email, password, or anonymous sign-in.',
  alternates: { canonical: '/login' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Sign in to Nodea',
    description: 'Free during beta. No credit card. No waitlist.',
    url: 'https://nodea.ai/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
