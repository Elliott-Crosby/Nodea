import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from './_components/landing/Nav'
import HeroVideo from './_components/landing/HeroVideo'
import Bluf from './_components/landing/Bluf'
import Contrast from './_components/landing/Contrast'
import Features from './_components/landing/Features'
import HowItWorks from './_components/landing/HowItWorks'
import Blog from './_components/landing/Blog'
import FaqSection, { HOMEPAGE_FAQ } from './_components/landing/FaqSection'
import CtaSection from './_components/landing/CtaSection'
import Footer from './_components/landing/Footer'
import './_components/landing/landing.css'

const SITE_URL = 'https://nodea.ai'

// FAQPage JSON-LD must mirror the visible FAQ content exactly.
// Speakable schema is a voice/AI-Overviews extraction hint pointing at
// the visible answer text under each <details> element.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOMEPAGE_FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

const speakableJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  url: `${SITE_URL}/`,
  name: 'Nodea — Branching AI Chat Canvas',
  description:
    'Nodea is a branching AI chat canvas. Fork any reply, compare branches side-by-side, never lose context. Built on Claude.',
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['#bluf-heading', '.ln-bluf-lede', '.ln-faq-a p'],
  },
}

const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Nodea — key pages',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'What is Nodea?',           url: `${SITE_URL}/what-is-nodea` },
    { '@type': 'ListItem', position: 2, name: 'Glossary',                 url: `${SITE_URL}/glossary` },
    { '@type': 'ListItem', position: 3, name: 'Pricing',                  url: `${SITE_URL}/upgrade` },
    { '@type': 'ListItem', position: 4, name: 'Blog',                     url: `${SITE_URL}/blog` },
    { '@type': 'ListItem', position: 5, name: 'Nodea vs ChatGPT',         url: `${SITE_URL}/compare/nodea-vs-chatgpt` },
    { '@type': 'ListItem', position: 6, name: 'Nodea vs Claude Projects', url: `${SITE_URL}/compare/nodea-vs-claude-projects` },
    { '@type': 'ListItem', position: 7, name: 'Nodea vs TypingMind',      url: `${SITE_URL}/compare/nodea-vs-typingmind` },
  ],
}

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/app')
  }

  return (
    <div className="ln-root">
      <Nav />
      <main>
        <HeroVideo />
        <Bluf />
        <Contrast />
        <Features />
        <HowItWorks />
        <Blog />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
    </div>
  )
}
