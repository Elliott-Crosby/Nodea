export default function Contrast() {
  return (
    <section className="ln-contrast">
      <div className="ln-container">
        <div className="ln-contrast-head">
          <h2 className="ln-h2">Every thought you&apos;ve had,<br /><em>without losing any.</em></h2>
        </div>

        <div className="ln-contrast-grid">
          {/* Left card — Linear/everywhere else */}
          <div className="ln-contrast-card faded">
            <span className="ln-card-tag">Everywhere else</span>
            <h3>One thread, scrolling forever.</h3>
            <p>
              Edit a prompt and the old reply vanishes. Try a different
              angle and you fork into a new chat. Context gets lost
              between tabs.
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
              Branch from any message to explore an alternative.
              Compare answers side by side. Color-code the keepers.
              Search across every path at once.
            </p>

            <div className="ln-mini-tree">
              <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid meet">
                {/* Edges — level 1 */}
                <path d="M 150 36 C 150 46 80 46 80 56"  fill="none" stroke="var(--edge-color)"  strokeWidth="1.5" />
                <path d="M 150 36 C 150 46 220 46 220 56" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                {/* Edges — level 2 */}
                <path d="M 80 82 C 80 94 50 94 50 106"   fill="none" stroke="var(--edge-color)"  strokeWidth="1.5" />
                <path d="M 220 82 C 220 94 185 94 185 106" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                <path d="M 220 82 C 220 94 255 94 255 106" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />

                {/* prompt — centered */}
                <g transform="translate(112, 8)">
                  <rect width="76" height="26" rx="7" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">prompt</text>
                </g>
                {/* draft A */}
                <g transform="translate(42, 56)">
                  <rect width="76" height="26" rx="7" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">draft A</text>
                </g>
                {/* draft B — active */}
                <g transform="translate(182, 56)">
                  <rect width="76" height="26" rx="7" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">draft B</text>
                </g>
                {/* edit */}
                <g transform="translate(12, 106)">
                  <rect width="76" height="24" rx="6" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">edit</text>
                </g>
                {/* rewrite — active */}
                <g transform="translate(147, 106)">
                  <rect width="76" height="24" rx="6" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">rewrite</text>
                </g>
                {/* ship it — active */}
                <g transform="translate(217, 106)">
                  <rect width="76" height="24" rx="6" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">ship it</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
