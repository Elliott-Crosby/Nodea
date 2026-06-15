import Link from 'next/link'
import { CHROME_STORE_URL } from '@/lib/links'

// Top-half landing section promoting the Chrome extension. Mirrors the /extension
// hero copy so the message is consistent across surfaces.
export default function ExtensionPromo() {
  return (
    <section className="ln-extpromo" id="extension">
      <div className="ln-container">
        <div className="ln-extpromo-grid">
          <Link href="/extension" className="ln-extpromo-media" aria-label="See the Nodea Tree for Claude extension">
            <img
              src="/media/nodea-ai-extension-claude-scaled.png"
              alt="The Nodea Tree for Claude extension docked beside a claude.ai conversation, drawing it as a branching tree of nodes."
              loading="lazy"
            />
          </Link>

          <div className="ln-extpromo-text">
            <span className="ln-kicker">Free Chrome extension</span>
            <h2 className="ln-h2">
              See your Claude chats <em>as a tree.</em>
            </h2>
            <p className="ln-lede">
              Every edit and regenerate in Claude.ai hides a branch. Nodea Tree for
              Claude draws that hidden tree right beside your chat &mdash; then imports
              the whole thing into Nodea, where you can fork, merge, and keep working.
            </p>
            <div className="ln-extpromo-ctas">
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ln-btn ln-btn-primary ln-btn-lg"
              >
                Add to Chrome &mdash; Free
              </a>
              <Link href="/extension" className="ln-btn ln-btn-outline ln-btn-lg">
                How it works
              </Link>
            </div>
            <p className="ln-extpromo-fine">
              Works on claude.ai · reads your own conversation through your login · not
              affiliated with Anthropic.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
