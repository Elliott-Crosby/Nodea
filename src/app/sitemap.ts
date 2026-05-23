import type { MetadataRoute } from 'next'

const SITE_URL = 'https://nodea.ai'

const BLOG_POSTS = [
  'branching-ai-chat-guide',
  'fork-chatgpt-conversation',
  'tree-of-thought-prompting',
  'compare-ai-model-outputs',
] as const

const COMPARE_PAGES = [
  'nodea-vs-chatgpt',
  'nodea-vs-claude-projects',
  'nodea-vs-typingmind',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/what-is-nodea`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/upgrade`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const blogRoutes: MetadataRoute.Sitemap = BLOG_POSTS.map((slug) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const compareRoutes: MetadataRoute.Sitemap = COMPARE_PAGES.map((slug) => ({
    url: `${SITE_URL}/compare/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes, ...compareRoutes]
}
