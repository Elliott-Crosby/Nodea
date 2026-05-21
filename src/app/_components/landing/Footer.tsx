import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="ln-footer">
      <div className="ln-container">
        <div className="ln-footer-brand">
          <Link href="/" className="ln-wordmark" style={{ fontSize: 22 }}>Nodea</Link>
          <span className="ln-footer-tagline">Think in branches.</span>
        </div>

        <nav className="ln-footer-links">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <button type="button" aria-disabled="true" className="ln-btn-noop">Pricing<span className="ln-soon-pill">soon</span></button>
          <button type="button" aria-disabled="true" className="ln-btn-noop">Changelog<span className="ln-soon-pill">soon</span></button>
          <button type="button" aria-disabled="true" className="ln-btn-noop">Third-party services<span className="ln-soon-pill">soon</span></button>
          <Link href="/login">Sign in</Link>
        </nav>

        <span className="ln-footer-copy">&copy; 2026 Nodea</span>
      </div>
    </footer>
  )
}
