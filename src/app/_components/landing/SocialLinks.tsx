'use client'

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'

/* ── Brand icons (simple-icons paths, 24×24, filled via currentColor) ── */
function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 6.844c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
  )
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
  )
}
function IconProductHunt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 12H10.2V8.4h3.4a1.8 1.8 0 1 1 0 3.6m0-6H7.8v12h2.4v-3.6h3.4a4.2 4.2 0 1 0 0-8.4M24 12c0 6.628-5.372 12-12 12S0 18.628 0 12 5.372 0 12 0s12 5.372 12 12" /></svg>
  )
}

type Social = {
  id: string
  href: string
  Icon: () => ReactElement
  /** Visible pill label. */
  action: string
  /** Accessible label (the visible label alone — e.g. "Follow" — is ambiguous). */
  aria: string
  primary?: boolean
  /** When true, the live GitHub star count is shown after the label. */
  showStars?: boolean
}

/* Source of truth — adding a network is one entry here, order and count follow. */
const SOCIALS: Social[] = [
  {
    id: 'github',
    href: 'https://github.com/Elliott-Crosby/Nodea',
    Icon: IconGitHub,
    action: 'Star on GitHub',
    aria: 'Star Nodea on GitHub',
    primary: true,
    showStars: true,
  },
  {
    id: 'x',
    href: 'https://x.com/nodeaAI',
    Icon: IconX,
    action: 'Follow',
    aria: 'Follow Nodea on X',
  },
  {
    id: 'producthunt',
    href: 'https://www.producthunt.com/products/nodea',
    Icon: IconProductHunt,
    action: 'Upvote',
    aria: 'Upvote Nodea on Product Hunt',
  },
]

/* Product Hunt "featured" badge — rendered in place of the pill when requested. */
const PH_BADGE_HREF =
  'https://www.producthunt.com/products/nodea?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-nodea'
const PH_BADGE_SRC =
  'https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1159548&theme=light&t=1780252758064'

/* One request shared across every <SocialLinks> instance on the page (hero + footer). */
let starsPromise: Promise<string | null> | null = null
function fetchStars(): Promise<string | null> {
  if (!starsPromise) {
    starsPromise = fetch('/api/github-stars')
      .then((r) => (r.ok ? r.json() : null))
      .then((d): string | null => (d && typeof d.formatted === 'string' ? d.formatted : null))
      .catch(() => null)
  }
  return starsPromise
}

/**
 * Social-link pills — Treatment B (footer) and U2 (under the hero demo).
 * The GitHub pill carries the live star count as social proof; if the count
 * can't be loaded the pill simply renders without it.
 */
export default function SocialLinks({
  className,
  productHuntBadge,
}: {
  className?: string
  /** Render Product Hunt as its featured badge image instead of a text pill. */
  productHuntBadge?: boolean
}) {
  const [stars, setStars] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchStars().then((formatted) => {
      if (alive) setStars(formatted)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className={'soc-row' + (className ? ' ' + className : '')} role="list">
      {SOCIALS.map(({ id, href, Icon, action, aria, primary, showStars }) => {
        if (productHuntBadge && id === 'producthunt') {
          return (
            <a
              key={id}
              role="listitem"
              className="ln-split-ph"
              href={PH_BADGE_HREF}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={PH_BADGE_SRC}
                alt="Nodea - Branch any AI reply. Explore ideas as a tree, not a thread. | Product Hunt"
                width={250}
                height={54}
              />
            </a>
          )
        }
        const count = showStars ? stars : null
        return (
          <a
            key={id}
            role="listitem"
            className={'soc-pill' + (primary ? ' primary' : '')}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={count ? `${aria} (${count} ${count === '1' ? 'star' : 'stars'})` : aria}
          >
            <Icon />
            <span>{action}</span>
            {count ? <span className="soc-count">{count}</span> : null}
          </a>
        )
      })}
    </div>
  )
}
