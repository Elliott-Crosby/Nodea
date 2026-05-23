import type { MetadataRoute } from 'next'
import { POSTS } from './blog/posts'

const SITE_URL = 'https://nodea.ai'

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
      url: `${SITE_URL}/glossary`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
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

  // Derive from POSTS so adding a new post in posts.ts auto-updates the sitemap.
  const blogRoutes: MetadataRoute.Sitemap = POSTS.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(p.publishedAt),
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
