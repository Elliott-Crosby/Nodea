import Link from 'next/link'
import SocialLinks from './SocialLinks'

export default function Footer() {
  return (
    <footer className="ln-footer">
      <div className="ln-container">
        <div className="ln-footer-brand">
          <Link href="/" className="ln-wordmark" style={{ fontSize: 22 }}>Nodea</Link>
          <span className="ln-footer-tagline">Think in branches.</span>
          <SocialLinks className="ln-footer-social" />
        </div>

        <nav className="ln-footer-links">
          <Link href="/what-is-nodea">What is Nodea</Link>
          <Link href="/glossary">Glossary</Link>
          <Link href="/blog">Blog</Link>
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <Link href="/upgrade">Pricing</Link>
          <Link href="/compare/nodea-vs-chatgpt">vs ChatGPT</Link>
          <Link href="/compare/nodea-vs-claude-projects">vs Claude</Link>
          <Link href="/compare/nodea-vs-typingmind">vs TypingMind</Link>
          <a href="/feed.xml">RSS</a>
          <Link href="/login">Sign in</Link>
        </nav>

        <span className="ln-footer-copy">&copy; 2026 Nodea</span>
      </div>
    </footer>
  )
}
