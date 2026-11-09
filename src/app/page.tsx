import { connection } from 'next/server'
import { CHROME_STORE_URL } from '@/lib/links'
import FeedbackForm from './_components/FeedbackForm'

export default async function Home() {
  // Request-time rendering lets Next attach the CSP nonce to its own scripts.
  await connection()

  return (
    <main className="farewell">
      <article className="letter">
        <h1>Thank you for<br />being here.</h1>
        <div className="letter-copy">
          <p>The Nodea web app is no longer available.</p>
          <p>Thank you for the ideas you explored here, and for giving Nodea a place in your day. It meant a lot.</p>
          <p>Nodea Tree, our Chrome extension, will continue to be supported. You can keep mapping your chats there. Imports into the web app have ended.</p>
          <p><a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">Get Nodea Tree for Chrome <span aria-hidden="true">↗</span></a></p>
          <p>For questions, account deletion, or a copy of your data, email <a href="mailto:nodea.ai@gmail.com">nodea.ai@gmail.com</a>.</p>
          <p className="signature">With gratitude,<br />Elliott, founder of Nodea</p>
        </div>
      </article>
      <FeedbackForm />
      <nav className="farewell-links" aria-label="More from Nodea"><a href="/blog">Blog</a><a href="/blog/nodea-web-app-shutdown">A note on closing</a></nav>
    </main>
  )
}
