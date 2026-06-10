// Single source of truth for the marketing nav links. Consumed by the site
// Nav and the demo page's nav so the lists can't drift. Hash links must stay
// root-relative ("/#...") so they work from non-home pages.
export const NAV_LINKS = [
  { label: 'What is Nodea', href: '/what-is-nodea' },
  { label: 'Glossary', href: '/glossary' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Features', href: '/#features' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pricing', href: '/upgrade' },
  { label: 'Demo', href: '/demo' },
] as const
