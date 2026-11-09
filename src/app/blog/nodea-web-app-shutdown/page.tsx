import type { Metadata } from 'next'
import { CHROME_STORE_URL } from '@/lib/links'
import { BlogNav, BlogFooter } from '@/app/_components/BlogChrome'

const title = 'The Nodea web app has closed. The extension continues.'
const description = 'Thank you for being part of Nodea. The web app is no longer available, and Nodea Tree will continue to be supported.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/blog/nodea-web-app-shutdown' },
  openGraph: { title, description, type: 'article', publishedTime: '2026-11-09', url: 'https://nodea.ai/blog/nodea-web-app-shutdown' },
}

export default function ShutdownPost() {
  return <>
    <BlogNav />
    <article className="legal shutdown-post">
      <h1>{title}</h1>
      <p><time dateTime="2026-11-09">November 9, 2026</time></p>
      <p>The Nodea web app at nodea.ai is now closed. You can no longer sign in, create conversations, or import chats into the web app.</p>
      <p>Thank you for trying Nodea, sharing your ideas, and trusting it with a part of your thinking. Every conversation and piece of feedback helped shape it.</p>
      <p><a href={CHROME_STORE_URL}>Nodea Tree, our Chrome extension</a>, will continue to be supported. You can keep using it to map conversations on Claude, ChatGPT, and Gemini. The “Open in Nodea” import feature is no longer available.</p>
      <p>The blog will stay online, and the web app’s source code is preserved.</p>
      <p>For questions, account deletion, or a copy of your data, email <a href="mailto:nodea.ai@gmail.com">nodea.ai@gmail.com</a>. For account requests, please write from the email linked to your account.</p>
      <p>Thank you for being here.</p>
      <p>With gratitude,<br />Elliott, founder of Nodea</p>
      <a href="/blog">All posts</a>
    </article>
    <BlogFooter />
  </>
}
