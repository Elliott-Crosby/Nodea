import Link from 'next/link'
import SocialLinks from './SocialLinks'

// Footer link groups. Keeping the full internal-link set (it carries SEO weight)
// but organized into labeled columns instead of one flat wall of links.
const FOOTER_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'What is Nodea', href: '/what-is-nodea' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Features', href: '#features' },
      { label: 'Demo', href: '/demo' },
      { label: 'Extension', href: '/extension' },
      { label: 'Pricing', href: '/upgrade' },
    ],
  },
  {
    title: 'Compare',
    links: [
      { label: 'All comparisons', href: '/compare' },
      { label: 'vs ChatGPT', href: '/compare/nodea-vs-chatgpt' },
      { label: 'vs Claude', href: '/compare/nodea-vs-claude-projects' },
      { label: 'vs Perplexity', href: '/compare/nodea-vs-perplexity' },
      { label: 'vs TypingMind', href: '/compare/nodea-vs-typingmind' },
      { label: 'vs LibreChat', href: '/compare/nodea-vs-librechat' },
      { label: 'vs Msty', href: '/compare/nodea-vs-msty' },
      { label: 'vs Poe', href: '/compare/nodea-vs-poe' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'Glossary', href: '/glossary' },
      { label: 'FAQ', href: '#faq' },
      { label: 'ChatGPT alternative', href: '/chatgpt-alternative' },
      { label: 'AI chat canvas', href: '/ai-chat-canvas' },
      { label: 'RSS', href: '/feed.xml' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Support', href: '/support' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Sign in', href: '/login' },
    ],
  },
]

// Hash anchors and static files (feed.xml) want a plain <a>; internal routes
// get Next's <Link> for client-side nav + prefetch.
function FooterLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith('#') || href.startsWith('/feed')) {
    return <a href={href}>{label}</a>
  }
  return <Link href={href}>{label}</Link>
}

export default function Footer() {
  return (
    <footer className="ln-footer">
      <div className="ln-container">
        <div className="ln-footer-brand">
          <Link href="/" className="ln-wordmark" style={{ fontSize: 22 }}>Nodea</Link>
          <span className="ln-footer-tagline">Think in branches.</span>
          <SocialLinks className="ln-footer-social" />
          <span className="ln-footer-copy">&copy; 2026 Nodea</span>
        </div>

        <nav className="ln-footer-links">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title} className="ln-footer-col">
              <span className="ln-footer-col-title">{group.title}</span>
              {group.links.map((link) => (
                <FooterLink key={link.href} href={link.href} label={link.label} />
              ))}
            </div>
          ))}
        </nav>
      </div>
    </footer>
  )
}
