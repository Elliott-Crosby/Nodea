import type { Metadata } from 'next'

const SITE_URL = 'https://nodea.ai'

export const metadata: Metadata = {
  title: 'Pricing — Free & Pro Plans',
  description:
    'Nodea is free during beta with a 25k daily token limit. Pro is $8/month: unlocks Claude Opus, 250k daily tokens, and early access to new features. Cancel anytime.',
  alternates: { canonical: '/upgrade' },
  openGraph: {
    title: 'Pricing — Nodea',
    description: 'Free with generous limits. Pro is $8/mo for Claude Opus and 10× the daily tokens.',
    url: `${SITE_URL}/upgrade`,
  },
}

// Product + Offer JSON-LD on the dedicated pricing page is more
// extractable than the root SoftwareApplication offer (per-page schema
// wins for commerce/pricing queries). Mirrors the visible plan facts.
const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Nodea',
  description:
    'Branching AI chat canvas built on Anthropic Claude. Fork any reply, compare branches side-by-side, never lose context.',
  brand: { '@type': 'Brand', name: 'Nodea' },
  url: `${SITE_URL}/upgrade`,
  category: 'AI chat application',
  offers: [
    {
      '@type': 'Offer',
      name: 'Nodea Free',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/login`,
      description: '25,000 daily tokens. Claude Haiku 4.5 + Sonnet 4.6. Unlimited branches.',
    },
    {
      '@type': 'Offer',
      name: 'Nodea Pro',
      price: '8',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/upgrade`,
      description: '250,000 daily tokens. Adds Claude Opus 4.7. Smarter model routing. Early access to new features.',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '8',
        priceCurrency: 'USD',
        billingDuration: 'P1M',
        unitText: 'month',
      },
    },
  ],
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',    item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${SITE_URL}/upgrade` },
  ],
}

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
  )
}
