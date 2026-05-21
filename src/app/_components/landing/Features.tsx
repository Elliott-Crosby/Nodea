export default function Features() {
  return (
    <section id="features" className="ln-features">
      <div className="ln-container">
        <div className="ln-features-head">
          <span className="ln-kicker">Features</span>
          <h2 className="ln-h2">Built around the idea<br />that thinking <em>forks.</em></h2>
          <p className="ln-lede ln-features-lede">
            Every feature exists to make branching feel natural — not
            like a workaround bolted onto a chat interface.
          </p>
        </div>

        <div className="ln-bento">
          {/* 1: Branch from any message */}
          <div className="ln-bcard wide">
            <span className="ln-bcard-num">01 — branch</span>
            <h3>Branch from any message</h3>
            <p>Hover any response and fork a new path — the original stays intact.</p>
            <div className="ln-bcard-art">
              <svg viewBox="0 0 240 80" width="240" height="80" style={{ overflow: 'visible' }}>
                {/* Root node */}
                <g transform="translate(82, 10)">
                  <rect width="76" height="26" rx="7" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">Ask Claude</text>
                </g>
                {/* Bézier edges */}
                <path d="M 120 37 C 120 45 70 45 70 53" fill="none" stroke="var(--edge-color)"  strokeWidth="1.5" />
                <path d="M 120 37 C 120 45 170 45 170 53" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                {/* Path A */}
                <g transform="translate(32, 54)">
                  <rect width="76" height="26" rx="7" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">Path A</text>
                </g>
                {/* Path B — active */}
                <g transform="translate(132, 54)">
                  <rect width="76" height="26" rx="7" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="17" textAnchor="middle" fontSize="10" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">Path B</text>
                </g>
              </svg>
            </div>
          </div>

          {/* 2: See your thinking */}
          <div className="ln-bcard wide">
            <span className="ln-bcard-num">02 — canvas</span>
            <h3>See your thinking</h3>
            <p>The canvas gives you a bird&apos;s-eye view of every path you&apos;ve explored.</p>
            <div className="ln-bcard-art">
              <svg viewBox="0 0 260 120" width="260" height="120" style={{ overflow: 'visible' }}>
                {/* Root */}
                <g transform="translate(92, 6)">
                  <rect width="76" height="24" rx="6" fill="var(--bg-base)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">Start</text>
                </g>
                {/* Bézier edges — level 1 */}
                <path d="M 130 32 C 130 42 60 42 60 53"  fill="none" stroke="var(--edge-color)" strokeWidth="1.5" />
                <path d="M 130 32 C 130 42 130 42 130 53" fill="none" stroke="var(--edge-color)" strokeWidth="1.5" />
                <path d="M 130 32 C 130 42 200 42 200 53" fill="none" stroke="var(--edge-color)" strokeWidth="1.5" />
                {/* Branch nodes */}
                {[22, 92, 162].map((x, i) => (
                  <g key={i} transform={`translate(${x}, 55)`}>
                    <rect width="76" height="24" rx="6" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
                    <text x="38" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">Branch {i + 1}</text>
                  </g>
                ))}
                {/* Bézier edges — level 2 */}
                <path d="M 60 81 C 60 88 40 88 40 96"  fill="none" stroke="var(--edge-color)" strokeWidth="1.5" />
                <path d="M 60 81 C 60 88 80 88 80 96"  fill="none" stroke="var(--edge-color)" strokeWidth="1.5" />
                <path d="M 200 81 C 200 88 200 88 200 96" fill="none" stroke="var(--edge-color)" strokeWidth="1.5" />
                {/* Grandchildren */}
                {[2, 42, 162].map((x, i) => (
                  <g key={i} transform={`translate(${x}, 100)`}>
                    <rect width="76" height="20" rx="5" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* 3: Color-code */}
          <div className="ln-bcard wide">
            <span className="ln-bcard-num">03 — color</span>
            <h3>Color-code the keepers</h3>
            <p>Tag branches with colors to track quality and intent at a glance.</p>
            <div className="ln-bcard-art">
              <div className="ln-swatches">
                <div className="ln-swatch" style={{ background: '#8b5cf6' }} />
                <div className="ln-swatch" style={{ background: '#10b981' }} />
                <div className="ln-swatch" style={{ background: '#f59e0b' }} />
                <div className="ln-swatch" style={{ background: '#ef4444' }} />
                <div className="ln-swatch outlined" />
              </div>
            </div>
          </div>

          {/* 4: Search */}
          <div className="ln-bcard wide">
            <span className="ln-bcard-num">04 — search</span>
            <h3>Search across every path</h3>
            <p>Find any message in any branch instantly — nothing gets buried.</p>
            <div className="ln-bcard-art">
              <div className="ln-palette">
                <div className="ln-palette-input">
                  <span className="ln-palette-q">phase 2 strategy</span>
                  <div className="ln-palette-cursor" />
                </div>
                <div className="ln-palette-result">
                  <span>Branch 3 &middot; message 7</span>
                  <span className="ln-palette-enter">↩</span>
                </div>
                <div className="ln-palette-result muted">
                  <span>Branch 1 &middot; message 4</span>
                  <span>—</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
