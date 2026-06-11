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

const LAST_UPDATED = 'June 11, 2026'

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

              <p>
                The &ldquo;Nodea Tree for Claude&rdquo; extension reads the branch
                structure of conversations you already have on{' '}
                <a href="https://claude.ai">claude.ai</a> and draws them as a visual
                tree inside the page. It does this using your existing, logged-in
                Claude session; we never ask for, see, or store your Claude
                credentials. The sections below describe, in full, what data we
                collect, how we use (handle) it, how and where it is stored, and how
                it is shared.
              </p>

              <h2>1. Data we collect</h2>
              <p>
                Nodea collects the following categories of user data. We do not
                collect any data not listed here.
              </p>

              <h3>Through the browser extension</h3>
              <ul>
                <li>
                  <strong>Authentication information.</strong> When you sign in to your
                  Nodea account from inside the extension, the sign-in form collects
                  your Nodea <strong>email and password</strong>. The password is used
                  only to authenticate you and is never stored by the extension. After
                  a successful sign-in, the extension caches your Nodea{' '}
                  <strong>session tokens</strong> (an access token, a refresh token,
                  their expiry, and your account id and email) so the panel stays
                  signed in across page reloads.
                </li>
                <li>
                  <strong>Personal communications &amp; website content.</strong> The
                  extension reads the content of the Claude conversation you are
                  viewing &mdash; the message text (your prompts and Claude&rsquo;s
                  replies), the branch structure, and message IDs &mdash; from
                  Claude&rsquo;s own API in your browser, in order to render the visual
                  tree and to power the &ldquo;Open in Nodea&rdquo; and
                  &ldquo;Update Conversation&rdquo; features.
                </li>
                <li>
                  <strong>Display preferences.</strong> Per-conversation settings such
                  as node colors, which you choose, so the map keeps its appearance
                  between visits.
                </li>
              </ul>

              <h3>Through the Nodea web app</h3>
              <ul>
                <li>
                  <strong>Personally identifiable information.</strong> Your email
                  address, collected when you create a Nodea account, used for
                  authentication.
                </li>
                <li>
                  <strong>Conversation content.</strong> The conversations you create
                  in Nodea or import from Claude, including the messages within them.
                </li>
              </ul>

              <h2>2. How we use your data (handling)</h2>
              <ul>
                <li>
                  <strong>Authentication information</strong> is used solely to sign you
                  in to your Nodea account and to keep that session active in the
                  extension panel and, when you choose, carry it over to the Nodea web
                  app. It is not used for any other purpose.
                </li>
                <li>
                  <strong>Claude conversation content</strong> read by the extension is
                  used only to draw the branch tree in your browser and, when you
                  explicitly click &ldquo;Open in Nodea&rdquo; or &ldquo;Update
                  Conversation,&rdquo; to rebuild that conversation inside your own
                  Nodea account.
                </li>
                <li>
                  <strong>Conversation content in the web app</strong> is used to show
                  you your conversations and, when you send a message, is processed by
                  our AI provider to generate a reply.
                </li>
                <li>
                  <strong>Display preferences</strong> are used only to render your map
                  with the colors you picked.
                </li>
              </ul>
              <p>
                We do <strong>not</strong> use any of this data for advertising,
                profiling, or to determine creditworthiness, and we do not sell or rent
                it.
              </p>

              <h2>3. How and where your data is stored (storage)</h2>
              <ul>
                <li>
                  <strong>Locally in your browser.</strong> The extension stores your
                  Nodea session tokens, your per-conversation color preferences, and
                  any pending &ldquo;Open in Nodea&rdquo; handoff payload using{' '}
                  <code>chrome.storage.local</code> on your own device. The handoff
                  payload (the conversation tree you chose to send) is written only when
                  you click &ldquo;Open in Nodea,&rdquo; is read once to deliver it to
                  the Nodea app, and is then immediately deleted.
                </li>
                <li>
                  <strong>While visualizing the tree,</strong> the Claude conversation
                  data stays in your browser. Nothing is sent to Nodea&rsquo;s servers
                  unless you explicitly trigger an import.
                </li>
                <li>
                  <strong>On our servers.</strong> Your Nodea account (email) and the
                  conversations you create or import are stored in our database, hosted
                  by Supabase. This data is protected by row-level security so it is
                  accessible only to your account.
                </li>
              </ul>

              <h2>4. How your data is shared (sharing)</h2>
              <p>
                We do not sell or rent your data, and we do not share it with third
                parties for their own purposes. We share data only with the service
                providers (processors) below, strictly to operate Nodea on our behalf:
              </p>
              <ul>
                <li><strong>Supabase</strong>: authentication and database (stores your account and conversations).</li>
                <li><strong>Anthropic</strong>: the Claude AI models that generate replies to messages you send in the web app.</li>
                <li><strong>Stripe</strong>: payment processing for paid plans (we never see your full card details).</li>
                <li><strong>Vercel</strong>: application hosting.</li>
              </ul>
              <p>
                When you click &ldquo;Open in Nodea&rdquo; or &ldquo;Update
                Conversation,&rdquo; the conversation tree you chose is sent to{' '}
                <strong>your own authenticated Nodea account</strong> so it can be
                rebuilt there. This happens only on your explicit action, never
                automatically, and the data goes only to your account &mdash; never to
                the developer or any analytics endpoint. The extension does not collect
                data from any site other than claude.ai and nodea.ai, and does not
                access your Claude data unless you have the extension installed and are
                actively using it.
              </p>

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
