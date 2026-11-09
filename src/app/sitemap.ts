import type { MetadataRoute } from 'next'
import { POSTS } from './blog/posts'
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/privacy', '/terms', '/blog', ...POSTS.map(post => '/blog/' + post.slug)]
    .map(path => ({ url: 'https://nodea.ai' + path }))
}
