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
          <Link href="/demo">Demo</Link>
          <Link href="/extension">Extension</Link>
          <Link href="/glossary">Glossary</Link>
          <Link href="/blog">Blog</Link>
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <Link href="/upgrade">Pricing</Link>
          <Link href="/chatgpt-alternative">ChatGPT alternative</Link>
          <Link href="/ai-chat-canvas">AI chat canvas</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/compare/nodea-vs-chatgpt">vs ChatGPT</Link>
          <Link href="/compare/nodea-vs-claude-projects">vs Claude</Link>
          <Link href="/compare/nodea-vs-typingmind">vs TypingMind</Link>
          <Link href="/compare/nodea-vs-perplexity">vs Perplexity</Link>
          <Link href="/compare/nodea-vs-librechat">vs LibreChat</Link>
          <Link href="/compare/nodea-vs-msty">vs Msty</Link>
          <Link href="/compare/nodea-vs-poe">vs Poe</Link>
          <a href="/feed.xml">RSS</a>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/login">Sign in</Link>
        </nav>

        <span className="ln-footer-copy">&copy; 2026 Nodea</span>
      </div>
    </footer>
  )
}
