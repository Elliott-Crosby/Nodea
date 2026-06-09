import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/_components/landing/Nav'
import Footer from '@/app/_components/landing/Footer'
import '@/app/_components/landing/landing.css'

export const metadata: Metadata = {
  title: { absolute: 'Nodea Tree for Claude — Import Chats as a Branching Tree' },
  description:
    'The Nodea browser extension imports your Claude chats as a branching tree. The full app at nodea.ai adds merging, notes, colors, search, and cross-chat memory.',
  alternates: { canonical: '/extension' },
  openGraph: {
    title: 'Do more with your imported chats — Nodea',
    description:
      'Merge branches, drop sticky notes, color your tree, and search everything. The features that only live in the full Nodea app.',
    url: 'https://nodea.ai/extension',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Do more with your imported chats — Nodea',
    description: 'The features that only live in the full Nodea app.',
  },
}

// Website-only capabilities — things the extension's capture-and-view can't do.
const FEATURES = [
  {
    emoji: '🔗',
    title: 'Merge branches',
    body: 'Explored three directions? Pull them back into one node and let the AI answer with all of that context combined. There is no way to do this in a linear chat.',
  },
  {
    emoji: '📝',
    title: 'Sticky notes',
    body: 'Drop notes anywhere on the canvas — plan a thread, leave yourself a reminder, label a region of the tree. Your annotations live right next to the conversation.',
  },
  {
    emoji: '🎨',
    title: 'Color your tree',
    body: 'Give branches a color so the important paths stand out at a glance. A big tree stays readable instead of turning into a wall of identical boxes.',
  },
  {
    emoji: '🔍',
    title: 'Search everything',
    body: 'Find any message across every conversation — by keyword, or by meaning with concept search. Your whole history becomes a place you can actually look things up.',
  },
  {
    emoji: '🧠',
    title: 'Cross-chat memory',
    body: 'Nodea remembers facts about you and your work across conversations, so you stop re-explaining yourself every time you start a new tree.',
  },
  {
    emoji: '🔀',
    title: 'Switch models per branch',
    body: 'Run a branch on fast Haiku, another on Opus for the heavy thinking. Pick the right Claude model for each part of the tree.',
  },
  {
    emoji: '📎',
    title: 'Attachments & export',
    body: 'Add images, PDFs, and files to any message, and export a whole conversation to Markdown when you want to take it with you.',
  },
  {
    emoji: '📁',
    title: 'Projects with shared memory',
    body: 'Group related chats into a Project with its own memory and context, so everything you do on a topic stays connected. (Pro)',
  },
]

export default function ExtensionUpsell() {
  return (
    <div className="ln-root">
      <Nav />

      <main>
        {/* ── Hero ─────────────────────────────────────── */}
        <section style={{ padding: '88px 0 56px' }}>
          <div className="ln-container" style={{ maxWidth: 760, textAlign: 'center' }}>
            <span className="ln-kicker">You imported a chat — here&rsquo;s the rest</span>
            <h1 style={{ fontSize: 'clamp(34px, 5vw, 52px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: '14px 0 18px' }}>
              The extension captures.<br />The canvas is where you work.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--ln-text-muted, #555)', maxWidth: 580, margin: '0 auto 28px' }}>
              The browser extension brings your Claude conversations into Nodea as a
              branching tree. That&rsquo;s the start. The full app is where you turn that
              tree into something you can actually think in.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/app" className="ln-btn ln-btn-primary ln-btn-lg">
                Open the full app
              </Link>
              <Link href="/what-is-nodea" className="ln-btn ln-btn-outline ln-btn-lg">
                How branching works
              </Link>
            </div>
          </div>
        </section>

        {/* ── Capture vs. canvas framing ───────────────── */}
        <section style={{ padding: '8px 0 8px' }}>
          <div className="ln-container" style={{ maxWidth: 860 }}>
            <div
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 16,
              }}
            >
              <div
                style={{
                  border: '1px solid var(--ln-border, #e5e5e5)', borderRadius: 14,
                  padding: '20px 22px', background: 'var(--ln-card, #fafafa)',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ln-text-muted, #777)', marginBottom: 10 }}>
                  The extension
                </div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--ln-text, #333)' }}>
                  Grabs your Claude chat and shows it as a tree. Great for capturing
                  and viewing — but it&rsquo;s read-only by nature.
                </p>
              </div>
              <div
                style={{
                  border: '1px solid color-mix(in srgb, var(--accent, #7c3aed) 35%, transparent)', borderRadius: 14,
                  padding: '20px 22px', background: 'color-mix(in srgb, var(--accent, #7c3aed) 7%, transparent)',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent, #7c3aed)', marginBottom: 10 }}>
                  The full app
                </div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--ln-text, #333)' }}>
                  Merge, annotate, color, search, and remember. Everything below only
                  exists at nodea.ai — your imported chats are already waiting there.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature grid ─────────────────────────────── */}
        <section style={{ padding: '40px 0 64px' }}>
          <div className="ln-container" style={{ maxWidth: 980 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', textAlign: 'center', letterSpacing: '-0.015em', margin: '0 0 8px' }}>
              What you unlock in the full app
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--ln-text-muted, #666)', fontSize: 16, margin: '0 0 36px' }}>
              None of this lives in the extension.
            </p>

            <div
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 18,
              }}
            >
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  style={{
                    border: '1px solid var(--ln-border, #e8e8e8)', borderRadius: 14,
                    padding: '22px 22px 24px', background: 'var(--ln-card, #fff)',
                  }}
                >
                  <div style={{ fontSize: 26, marginBottom: 12 }} aria-hidden>{f.emoji}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 650, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                    {f.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--ln-text-muted, #555)' }}>
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────── */}
        <section style={{ padding: '8px 0 96px' }}>
          <div className="ln-container" style={{ maxWidth: 640, textAlign: 'center' }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 34px)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>
              Your imported chats are already there.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--ln-text-muted, #555)', margin: '0 0 26px' }}>
              Open the full canvas and pick up exactly where the extension left off.
            </p>
            <Link href="/app" className="ln-btn ln-btn-primary ln-btn-lg">
              Open Nodea →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
