import { CHROME_STORE_URL } from '@/lib/links'

export function BlogNav() {
  return (
    <header className="blog-chrome">
      <nav aria-label="Main navigation"><a href="/">Back to Nodea</a><a href="/blog">Blog</a></nav>
      <p>The Nodea web app has closed. <a href="/blog/nodea-web-app-shutdown">The extension will continue to be supported.</a></p>
    </header>
  )
}

export function BlogFooter() {
  return <footer className="blog-chrome"><nav aria-label="Footer"><a href={CHROME_STORE_URL}>Chrome extension ↗</a><a href="mailto:nodea.ai@gmail.com">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer>
}
