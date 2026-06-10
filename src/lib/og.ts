// Shared OG/Twitter card images, mirroring the root layout (src/app/layout.tsx).
// In this Next version a page-level `openGraph` replaces the root layout's
// entirely (no deep merge), so every page that defines its own og block must
// include images explicitly.
export const OG_IMAGES = [
  {
    url: '/og/primary.png',
    width: 2400,
    height: 1260,
    type: 'image/png',
    alt: 'Nodea — Branching AI Chat Canvas. Fork any reply, compare branches side-by-side, and never lose context.',
  },
  {
    url: '/og/secondary.png',
    width: 2400,
    height: 1260,
    type: 'image/png',
    alt: 'Same model, better thinking — a linear chat buries earlier ideas in scroll, while the Nodea canvas keeps every branch so you can compare and keep the best.',
  },
]

// Twitter renders a single card image, so it gets the primary only.
export const TWITTER_IMAGES = [OG_IMAGES[0]]
