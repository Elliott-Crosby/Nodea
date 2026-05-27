import type { Metadata } from 'next'
import { ThemeProvider } from '@/lib/theme'
import { DM_Sans, Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { PageTracker } from './_components/PageTracker'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-bricolage',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

const SITE_URL = 'https://nodea.ai'
const SITE_NAME = 'Nodea'
const DEFAULT_TITLE = 'Nodea — Branching AI Chat Canvas'
const DEFAULT_DESC =
  'Nodea is a branching AI chat canvas. Fork any reply, compare branches side-by-side, and never lose context. Built on Claude. Free during beta — no credit card.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s | Nodea',
  },
  description: DEFAULT_DESC,
  applicationName: SITE_NAME,
  keywords: [
    'Nodea',
    'Nodea AI',
    'branching AI chat',
    'AI conversation tree',
    'ChatGPT alternative',
    'Claude chat',
    'non-linear AI chat',
    'fork ChatGPT conversation',
    'tree of thought AI',
    'AI brainstorming tool',
    'compare AI responses',
    'AI chat canvas',
  ],
  authors: [{ name: 'Nodea' }],
  creator: 'Nodea',
  publisher: 'Nodea',
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': `${SITE_URL}/feed.xml` },
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
  verification: {
    google: 'gAA5jhPiRp1ygM5edRO1kL1Wc_QEK2YVg8S12TqGeyI',
  },
}

const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: ['Nodea AI', 'Nodea.ai'],
  description: DEFAULT_DESC,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  sameAs: ['https://github.com/Elliott-Crosby/Nodea'],
}

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: 'Nodea AI',
  url: SITE_URL,
  description: DEFAULT_DESC,
  publisher: { '@id': `${SITE_URL}/#organization` },
  inLanguage: 'en-US',
}

const SOFTWARE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: DEFAULT_DESC,
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '8',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '8',
        priceCurrency: 'USD',
        billingDuration: 'P1M',
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nodea-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_JSONLD) }}
        />
      </head>
      <body className={`${dmSans.variable} ${bricolage.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
        <PageTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
