import { POSTS } from '@/app/blog/posts'

const SITE_URL = 'https://nodea.ai'
const SITE_NAME = 'Nodea'
const SITE_DESC =
  'Essays and guides on branching AI chat, prompt design, Claude vs ChatGPT, and the craft of building a tree-shaped conversation tool.'

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case "'": return '&apos;'
      case '"': return '&quot;'
      default:  return c
    }
  })
}

export const dynamic = 'force-static'
export const revalidate = 3600 // 1 hour — keeps the feed fresh without per-request work

export async function GET() {
  const buildDate = new Date().toUTCString()

  const items = [...POSTS]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .map((p) => {
      const url = `${SITE_URL}/blog/${p.slug}`
      const pubDate = new Date(p.publishedAt).toUTCString()
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(p.description)}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(p.category)}</category>
    </item>`
    })
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)} Blog — Branching AI Chat</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE_DESC)}</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <generator>Nodea (Next.js)</generator>
${items}
  </channel>
</rss>
`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
