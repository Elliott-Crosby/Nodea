export default function Contrast() {
  return (
    <section className="ln-contrast">
      <div className="ln-container">
        <div className="ln-contrast-head">
          <span className="ln-kicker">The Shift</span>
          <h2 className="ln-h2">Chat is a line.<br />Thinking <em>isn&apos;t.</em></h2>
          <p className="ln-lede ln-contrast-lede">
            Every AI chat app forces you into a single thread.
            But ideas branch, dead-ends happen, and the best insight
            often lives three forks back. Nodea maps the whole thing.
          </p>
        </div>

        <div className="ln-contrast-grid">
          {/* Left card — Linear/everywhere else */}
          <div className="ln-contrast-card faded">
            <span className="ln-card-tag">Everywhere else</span>
            <h3>One thread, scrolling forever.</h3>
            <p>
              A single timeline means one idea at a time. When you
              want to explore an alternative, you lose everything
              you already built.
            </p>

            <div className="ln-chat-bars">
              <div className="ln-chat-bar user" />
              <div className="ln-chat-bar ai" />
              <div className="ln-chat-bar user w2" style={{ opacity: 0.6 }} />
              <div className="ln-chat-bar ai w2"   style={{ opacity: 0.6 }} />
              <div className="ln-chat-bar user"    style={{ opacity: 0.3 }} />
              <div className="ln-chat-bar ai"      style={{ opacity: 0.3 }} />
              <div className="ln-chat-bar faded"   style={{ height: 60, opacity: 0.15 }} />
            </div>
          </div>

          {/* Right card — Nodea */}
          <div className="ln-contrast-card highlighted">
            <span className="ln-card-tag">In Nodea</span>
            <h3>A map of every thought you&apos;ve had.</h3>
            <p>
              Branch from any message, follow multiple paths simultaneously,
              and jump back to any point. Your context is never lost.
            </p>

            <div className="ln-mini-tree">
              <svg viewBox="0 0 280 120" preserveAspectRatio="xMidYMid meet">
                {/* Bézier edges */}
                <path d="M 140 34 C 140 44 60 44 60 54"   fill="none" stroke="var(--edge-color)"  strokeWidth="1.5" />
                <path d="M 140 34 C 140 44 140 44 140 54" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                <path d="M 140 34 C 140 44 220 44 220 54" fill="none" stroke="var(--edge-color)"  strokeWidth="1.5" />
                <path d="M 140 82 C 140 88 100 88 100 94" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                <path d="M 140 82 C 140 88 180 88 180 94" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />

                {/* Root */}
                <g transform="translate(102, 7)">
                  <rect width="76" height="26" rx="7" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">Launch plan</text>
                </g>
                {/* p1 */}
                <g transform="translate(22, 55)">
                  <rect width="76" height="26" rx="7" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">Phase 1</text>
                </g>
                {/* p2 active */}
                <g transform="translate(102, 55)">
                  <rect width="76" height="26" rx="7" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">Phase 2</text>
                </g>
                {/* p3 */}
                <g transform="translate(182, 55)">
                  <rect width="76" height="26" rx="7" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">Phase 3</text>
                </g>
                {/* c1 active */}
                <g transform="translate(62, 95)">
                  <rect width="76" height="26" rx="7" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">Channels</text>
                </g>
                {/* c2 active */}
                <g transform="translate(142, 95)">
                  <rect width="76" height="26" rx="7" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">Messaging</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
