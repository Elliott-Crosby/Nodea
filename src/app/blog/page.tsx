import type { Metadata } from 'next'
import { POSTS } from './posts'
import { BlogNav, BlogFooter } from '@/app/_components/BlogChrome'

export const metadata: Metadata = {
  title: 'Blog | Nodea',
  description: 'Updates from Nodea, and the original essays on branching conversations and thinking with AI.',
  alternates: { canonical: '/blog', types: { 'application/rss+xml': 'https://nodea.ai/feed.xml' } },
}

export default function BlogIndex() {
  return <>
    <BlogNav />
    <main className="legal blog-index">
      <h1>From Nodea.</h1>
      {POSTS.map(post => <article key={post.slug}>
        <p><time dateTime={post.publishedAt}>{new Date(post.publishedAt + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}</time></p>
        <h2><a href={'/blog/' + post.slug}>{post.title}</a></h2>
        <p>{post.description}</p>
      </article>)}
    </main>
    <BlogFooter />
  </>
}
