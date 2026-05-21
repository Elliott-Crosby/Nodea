export default function HowItWorks() {
  return (
    <section id="how-it-works" className="ln-how">
      <div className="ln-container">
        <div className="ln-how-head">
          <span className="ln-kicker">How It Works</span>
          <h2 className="ln-h2">Three motions. <em>That&apos;s it.</em></h2>
        </div>

        <div className="ln-steps">
          {/* 01 Ask */}
          <div className="ln-step">
            <span className="ln-step-num">01 / ASK</span>
            <h3>Start a conversation</h3>
            <p>
              Type anything — a question, a problem, a half-formed idea.
              Claude responds just like you expect.
            </p>
            <div className="ln-step-art">
              <svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet">
                {/* User bar */}
                <rect x="80" y="10" width="100" height="18" rx="6" fill="var(--user-bubble-bg)" stroke="var(--user-bubble-border)" strokeWidth="1" />
                {/* AI bar 1 */}
                <rect x="20" y="34" width="120" height="18" rx="6" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
                {/* AI bar 2 */}
                <rect x="20" y="56" width="88" height="14" rx="5" fill="var(--bg-base)" stroke="var(--border)" strokeWidth="1" />
              </svg>
            </div>
          </div>

          {/* 02 Branch */}
          <div className="ln-step">
            <span className="ln-step-num">02 / BRANCH</span>
            <h3>Fork any moment</h3>
            <p>
              Hover any message and hit branch. A new path opens —
              your original is preserved exactly where you left it.
            </p>
            <div className="ln-step-art">
              <svg viewBox="0 0 180 80" preserveAspectRatio="xMidYMid meet">
                {/* Root */}
                <g transform="translate(52, 8)">
                  <rect width="76" height="24" rx="6" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">message</text>
                </g>
                {/* Bézier edges */}
                <path d="M 90 34 C 90 42 50 42 50 50"  fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                <path d="M 90 34 C 90 42 130 42 130 50" fill="none" stroke="var(--edge-color)"  strokeWidth="1.5" />
                {/* Left — active */}
                <g transform="translate(12, 52)">
                  <rect width="76" height="24" rx="6" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">branch A</text>
                </g>
                {/* Right */}
                <g transform="translate(92, 52)">
                  <rect width="76" height="24" rx="6" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">branch B</text>
                </g>
              </svg>
            </div>
          </div>

          {/* 03 Navigate */}
          <div className="ln-step">
            <span className="ln-step-num">03 / NAVIGATE</span>
            <h3>Jump between paths</h3>
            <p>
              Click any node in the canvas to instantly switch context —
              full conversation history, no scrolling.
            </p>
            <div className="ln-step-art">
              <svg viewBox="0 0 180 80" preserveAspectRatio="xMidYMid meet">
                {/* Root */}
                <g transform="translate(52, 8)">
                  <rect width="76" height="24" rx="6" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">message</text>
                </g>
                {/* Bézier edges */}
                <path d="M 90 34 C 90 42 50 42 50 50"  fill="none" stroke="var(--edge-color)"  strokeWidth="1.5" />
                <path d="M 90 34 C 90 42 130 42 130 50" fill="none" stroke="var(--edge-active)" strokeWidth="1.5" />
                {/* Left */}
                <g transform="translate(12, 52)">
                  <rect width="76" height="24" rx="6" fill="var(--bg-muted)" stroke="var(--border)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--text-secondary)">branch A</text>
                </g>
                {/* Right — active, with SVG cursor arrow */}
                <g transform="translate(92, 52)">
                  <rect width="76" height="24" rx="6" fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth="1" />
                  <text x="38" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-dm-sans,sans-serif)" fill="var(--accent-text)">branch B</text>
                </g>
                {/* Cursor arrow above active node */}
                <g transform="translate(152, 44)">
                  <path d="M 0 0 L 12 4 L 5 6 L 4 13 Z" fill="var(--accent)" stroke="var(--bg-base)" strokeWidth="1" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
