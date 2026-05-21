import Link from 'next/link'

export default function CtaSection() {
  return (
    <section className="ln-cta">
      <div className="ln-container">
        <h2 className="ln-h2">
          Stop scrolling.<br />
          Start <em>branching.</em>
        </h2>
        <p className="ln-cta-sub">
          Free while in beta. Bring your own API keys or use ours —
          no credit card required to get started.
        </p>
        <div className="ln-cta-btns">
          <Link href="/login" className="ln-btn ln-btn-primary ln-btn-lg">
            Create your first canvas
          </Link>
          <a href="#how-it-works" className="ln-btn ln-btn-outline ln-btn-lg">
            See the canvas in motion
          </a>
        </div>
      </div>
    </section>
  )
}
