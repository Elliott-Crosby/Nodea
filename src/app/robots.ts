import type { MetadataRoute } from 'next'

const SITE_URL = 'https://nodea.ai'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/app',
          '/app/',
          '/admin',
          '/admin/',
          '/api/',
          '/login/update-password',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
