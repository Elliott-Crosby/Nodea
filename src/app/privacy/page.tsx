import type { Metadata } from 'next'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Nodea and the "Nodea Tree for Claude" browser extension collect, use, store, and transmit your data.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = 'June 2, 2026'

export default function PrivacyPage() {
  return (
    <div className="ln-root">
      <Nav />

      <main>
        <section style={{ padding: '80px 0 64px' }}>
          <div className="ln-container" style={{ maxWidth: 760 }}>
            <span className="ln-kicker">Legal</span>
            <h1 style={{ fontSize: '2.4rem', margin: '0.4em 0 0.2em', letterSpacing: '-0.02em' }}>
              Privacy Policy
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
              Last updated: {LAST_UPDATED}
            </p>

            <div className="ln-legal">
              <p>
                This policy explains how Nodea (&ldquo;Nodea,&rdquo; &ldquo;we,&rdquo;
                &ldquo;us&rdquo;) handles your data across both the Nodea web app at{' '}
                <a href="https://nodea.ai">nodea.ai</a> and the{' '}
                <strong>&ldquo;Nodea Tree for Claude&rdquo;</strong> browser extension.
              </p>

              <h2>The browser extension</h2>
              <p>
                The &ldquo;Nodea Tree for Claude&rdquo; extension reads the branch
                structure of conversations you already have on{' '}
                <a href="https://claude.ai">claude.ai</a> and draws them as a visual
                tree inside the page. It does this using your existing, logged-in
                Claude session; we never ask for, see, or store your Claude
                credentials.
              </p>

              <h3>What the extension accesses</h3>
              <ul>
                <li>
                  <strong>Your Claude conversation content</strong>{' '}(messages, branch
                  structure, message IDs), read from Claude&rsquo;s own API in your
                  browser, solely to render the tree and to power the
                  &ldquo;Open in Nodea&rdquo; and &ldquo;Update Conversation&rdquo;
                  features.
                </li>
                <li>
                  <strong>Per-conversation display preferences</strong> (such as node
                  colors), stored locally in your browser via{' '}
                  <code>chrome.storage</code>.
                </li>
              </ul>

              <h3>What is transmitted, and when</h3>
              <ul>
                <li>
                  <strong>Reading / visualizing the tree:</strong>{' '}conversation data
                  stays in your browser. Nothing is sent to Nodea&rsquo;s servers.
                </li>
                <li>
                  <strong>Only when you click &ldquo;Open in Nodea&rdquo;</strong>
                  {' '}(or &ldquo;Update Conversation&rdquo;): the conversation tree
                  you chose is sent to your authenticated Nodea account so it can be
                  rebuilt as a Nodea conversation. This happens only on your explicit
                  action, never automatically.
                </li>
              </ul>

              <h3>What we do NOT do</h3>
              <ul>
                <li>We do not sell or rent your data.</li>
                <li>We do not use your data for advertising.</li>
                <li>We do not transfer your data to third parties except as needed to provide the service (see &ldquo;Service providers&rdquo; below).</li>
                <li>We do not collect data from any site other than claude.ai and nodea.ai.</li>
                <li>We do not access your Claude data unless you have the extension installed and are using it.</li>
              </ul>

              <h2>The Nodea web app</h2>
              <p>
                When you create a Nodea account, we store your email address (for
                authentication) and the conversations you create or import. Chat
                messages you send are processed by our AI provider to generate
                responses. We use this data only to operate the product: show you
                your conversations, generate replies, and manage your plan and usage.
              </p>

              <h2>Service providers</h2>
              <p>We rely on the following processors to run Nodea:</p>
              <ul>
                <li><strong>Supabase</strong>: authentication and database (stores your account and conversations).</li>
                <li><strong>Anthropic</strong>: the Claude AI models that generate replies.</li>
                <li><strong>Stripe</strong>: payment processing for paid plans (we never see your full card details).</li>
                <li><strong>Vercel</strong>: application hosting.</li>
              </ul>

              <h2>Data retention &amp; deletion</h2>
              <p>
                Your conversations are kept until you delete them or close your
                account. To delete your account and associated data, email us at the
                address below and we will remove it.
              </p>

              <h2>Limited Use disclosure</h2>
              <p>
                The &ldquo;Nodea Tree for Claude&rdquo; extension&rsquo;s use of
                information received from Claude/claude.ai adheres to the{' '}
                <a
                  href="https://developer.chrome.com/docs/webstore/program-policies/limited-use/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chrome Web Store User Data Policy
                </a>
                , including the Limited Use requirements. Conversation data is used
                only to provide and improve the user-facing tree-visualization and
                import features described above; it is not transferred or used for any
                other purpose.
              </p>

              <h2>Not affiliated with Anthropic</h2>
              <p>
                Nodea and the &ldquo;Nodea Tree for Claude&rdquo; extension are not
                affiliated with, endorsed by, or sponsored by Anthropic. &ldquo;Claude&rdquo;
                is a trademark of Anthropic, PBC.
              </p>

              <h2>Changes to this policy</h2>
              <p>
                We may update this policy from time to time. Material changes will be
                reflected by the &ldquo;Last updated&rdquo; date above.
              </p>

              <h2>Contact</h2>
              <p>
                Questions about privacy or data deletion requests:{' '}
                <a href="mailto:nodea.ai@gmail.com">nodea.ai@gmail.com</a>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
