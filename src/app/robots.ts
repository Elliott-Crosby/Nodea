import type { MetadataRoute } from 'next'

const SITE_URL = 'https://nodea.ai'

// Routes that should never be indexed (require auth or are API surface)
const DISALLOWED = [
  '/app',
  '/app/',
  '/admin',
  '/admin/',
  '/api/',
  '/login/update-password',
]

// AI / generative-engine crawlers we explicitly want to read the site.
// Names verified May 2026; the field moves fast — re-verify before relying
// on this for a new platform. See each vendor's published bot docs:
//   OpenAI:     https://platform.openai.com/docs/bots
//   Anthropic:  https://docs.anthropic.com/en/api/claude-on-the-web
//   Perplexity: https://docs.perplexity.ai/guides/bots
//   Google:     https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
//   Apple:      https://support.apple.com/en-us/119829
const AI_BOTS = [
  // OpenAI
  'GPTBot',           // Training-data crawler
  'OAI-SearchBot',    // SearchGPT index crawler
  'ChatGPT-User',     // Live fetch when ChatGPT browses on a user's behalf
  // Anthropic
  'ClaudeBot',        // Training-data crawler
  'Claude-SearchBot', // Search index crawler
  'Claude-User',      // Live fetch when Claude browses on a user's behalf
  'anthropic-ai',     // Legacy / general Anthropic user-agent
  // Perplexity
  'PerplexityBot',    // Index crawler
  'Perplexity-User',  // Live fetch on user behalf
  // Google
  'Google-Extended',  // AI-product opt-in (Gemini, Vertex AI)
  // Apple
  'Applebot-Extended',// AI-product opt-in (Apple Intelligence)
  // Meta
  'meta-externalagent', // Meta AI / Llama training opt-in
  // Common Crawl (feeds many open LLM datasets)
  'CCBot',
] as const

export default function robots(): MetadataRoute.Robots {
  const explicitAiRules = AI_BOTS.map((userAgent) => ({
    userAgent,
    allow: '/',
    disallow: DISALLOWED,
  }))

  return {
    rules: [
      // Default for any other bot — allow the public surface, block private routes.
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED,
      },
      // Explicit named allowlist for AI / generative-engine crawlers.
      // This is a positive signal to platforms that read robots.txt strictly,
      // and a defensive override if a future CDN/WAF default-denies them.
      ...explicitAiRules,
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
