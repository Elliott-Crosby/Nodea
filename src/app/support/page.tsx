import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import SupportForm from './SupportForm'
import '@/app/_components/landing/landing.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea AI Support — Help, Billing & Bug Reports' },
  description:
    'Get help with Nodea, the branching AI chat canvas. Reach the team about billing, bugs, feature requests, or the "Nodea Tree for Claude" browser extension.',
  alternates: { canonical: '/support' },
  robots: { index: true, follow: true },
}

export default function SupportPage() {
  return (
    <div className="ln-root">
      <Nav />

      <main>
        <section style={{ padding: '80px 0 64px' }}>
          <div className="ln-container" style={{ maxWidth: 760 }}>
            <span className="ln-kicker">Support</span>
            <h1 style={{ fontSize: '2.4rem', margin: '0.4em 0 0.2em', letterSpacing: '-0.02em' }}>
              How can we help?
            </h1>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '1.05rem',
                lineHeight: 1.6,
                marginBottom: '2.5rem',
              }}
            >
              Questions, bug reports, billing, or feedback on Nodea — the branching
              AI chat canvas — all reach the same place. Send a message below or
              email{' '}
              <a href="mailto:nodea.ai@gmail.com" style={{ color: 'var(--accent-text)' }}>
                nodea.ai@gmail.com
              </a>{' '}
              directly. We usually reply within 1–2 business days.
            </p>

            <div className="ln-legal">
              <h2>Before you write</h2>
              <p>A few answers already live on the site:</p>
              <ul>
                <li>
                  <Link href="/what-is-nodea">What is Nodea</Link> — how branching
                  works and what it&rsquo;s for.
                </li>
                <li>
                  <Link href="/upgrade">Pricing &amp; plans</Link> — what&rsquo;s
                  free, what&rsquo;s paid, and how billing works.
                </li>
                <li>
                  <Link href="/extension">Nodea Tree for Claude</Link> — the browser
                  extension that turns your Claude chats into a visual tree.
                </li>
                <li>
                  <Link href="/privacy">Privacy</Link> and{' '}
                  <Link href="/terms">Terms</Link> — how we handle your data and the
                  rules of the road.
                </li>
              </ul>

              <h2>Send us a message</h2>
              <p>
                Include your account email if it differs from your reply address, and
                as much detail as you can — steps to reproduce a bug, a screenshot, or
                the conversation you were working in all help us help you faster.
              </p>
            </div>

            <SupportForm />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
