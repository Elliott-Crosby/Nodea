import type { Metadata } from 'next'

const SITE_URL = 'https://nodea.ai'

export const metadata: Metadata = {
  title: 'Pricing — Free & Pro Plans',
  description:
    'Nodea is free during beta with 25k daily / 450k monthly tokens. Pro is $8/mo for Claude Opus, 50k daily / 1M monthly tokens, and early access. Cancel anytime.',
  alternates: { canonical: '/upgrade' },
  openGraph: {
    title: 'Pricing — Nodea',
    description: 'Free with generous limits. Pro is $8/mo for Claude Opus, doubled daily tokens, and a 1M monthly budget.',
    url: `${SITE_URL}/upgrade`,
  },
}

// Digital-subscription merchant fields. Google's Merchant Listings validator
// requires these on Offer even for non-shippable SaaS — NotPermitted + $0
// instant delivery is the canonical shape.
const DIGITAL_RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
}

const DIGITAL_SHIPPING = {
  '@type': 'OfferShippingDetails',
  shippingRate: {
    '@type': 'MonetaryAmount',
    value: '0',
    currency: 'USD',
  },
  shippingDestination: {
    '@type': 'DefinedRegion',
    geoMidpoint: { '@type': 'GeoCoordinates', latitude: 0, longitude: 0 },
  },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
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
  image: `${SITE_URL}/og/primary.png`,
  category: 'AI chat application',
  offers: [
    {
      '@type': 'Offer',
      name: 'Nodea Free',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/login`,
      image: `${SITE_URL}/og/primary.png`,
      description: '25,000 daily / 450,000 monthly tokens. Claude Haiku 4.5 + Sonnet 4.6. Unlimited branches.',
      hasMerchantReturnPolicy: DIGITAL_RETURN_POLICY,
      shippingDetails: DIGITAL_SHIPPING,
    },
    {
      '@type': 'Offer',
      name: 'Nodea Pro',
      price: '8',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/upgrade`,
      image: `${SITE_URL}/og/primary.png`,
      description: '50,000 daily / 1,000,000 monthly tokens. Adds Claude Opus 4.7. Smarter model routing. Early access to new features.',
      hasMerchantReturnPolicy: DIGITAL_RETURN_POLICY,
      shippingDetails: DIGITAL_SHIPPING,
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
