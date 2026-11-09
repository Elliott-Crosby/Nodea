import type { Metadata } from 'next'
import './globals.css'

const description = 'The Nodea web app is no longer available. Thank you for being part of it.'

export const metadata: Metadata = {
  metadataBase: new URL('https://nodea.ai'),
  title: 'Thank you for being here | Nodea',
  description,
  alternates: { canonical: '/' },
  openGraph: { title: 'Thank you for being here | Nodea', description, url: 'https://nodea.ai', type: 'website' },
  twitter: { card: 'summary', title: 'Thank you for being here | Nodea', description },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
