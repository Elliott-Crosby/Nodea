import { ImageResponse } from 'next/og'

export const alt = 'Nodea — Branching AI Chat Canvas. Fork any reply, compare branches side-by-side.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(140deg, #0a0314 0%, #170a36 55%, #2a1870 100%)',
          padding: '72px 80px',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: '#fff',
            opacity: 0.9,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Nodea
        </div>

        {/* Main row: copy + tree */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 24,
            gap: 56,
          }}
        >
          {/* Left: headline */}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#c4b5fd',
                marginBottom: 16,
              }}
            >
              Branching AI Chat
            </div>
            <div
              style={{
                fontSize: 82,
                fontWeight: 800,
                letterSpacing: '-2px',
                lineHeight: 1.02,
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span>Stop scrolling.</span>
              <span style={{ fontStyle: 'italic', color: '#c4b5fd' }}>
                Start branching.
              </span>
            </div>
            <div
              style={{
                marginTop: 28,
                fontSize: 22,
                lineHeight: 1.35,
                color: 'rgba(255,255,255,0.72)',
                maxWidth: 560,
              }}
            >
              Fork any reply. Compare branches. Never lose context.
            </div>
          </div>

          {/* Right: tree illustration */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 320,
              height: 320,
            }}
          >
            <svg width="320" height="320" viewBox="0 0 320 320">
              {/* Edges */}
              <path d="M 160 60 C 160 100 80 100 80 140"  fill="none" stroke="rgba(196,181,253,0.4)" strokeWidth="2" />
              <path d="M 160 60 C 160 100 160 100 160 140" fill="none" stroke="#c4b5fd"              strokeWidth="3" />
              <path d="M 160 60 C 160 100 240 100 240 140" fill="none" stroke="rgba(196,181,253,0.4)" strokeWidth="2" />
              <path d="M 160 140 C 160 180 110 180 110 220" fill="none" stroke="#c4b5fd" strokeWidth="3" />
              <path d="M 160 140 C 160 180 210 180 210 220" fill="none" stroke="#c4b5fd" strokeWidth="3" />

              {/* Root node */}
              <rect x="110" y="40" width="100" height="40" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

              {/* Level 1 */}
              <rect x="30"  y="120" width="100" height="40" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              <rect x="110" y="120" width="100" height="40" rx="10" fill="rgba(196,181,253,0.18)" stroke="#c4b5fd" strokeWidth="2" />
              <rect x="190" y="120" width="100" height="40" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />

              {/* Level 2 */}
              <rect x="60"  y="200" width="100" height="40" rx="10" fill="rgba(196,181,253,0.18)" stroke="#c4b5fd" strokeWidth="2" />
              <rect x="160" y="200" width="100" height="40" rx="10" fill="rgba(196,181,253,0.18)" stroke="#c4b5fd" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            fontSize: 18,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <div style={{ display: 'flex' }}>Free during beta · No credit card</div>
          <div style={{ display: 'flex', color: '#c4b5fd' }}>nodea.ai</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
