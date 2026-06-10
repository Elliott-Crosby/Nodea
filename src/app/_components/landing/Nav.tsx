'use client'

import { useTheme } from '@/lib/theme'
import { Sun, Moon } from 'lucide-react'
import Link from 'next/link'

export default function Nav() {
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="ln-nav">
      <div className="ln-container">
        <div className="ln-nav-left">
          <Link href="/" className="ln-wordmark">Nodea</Link>

          <ul className="ln-nav-links">
            <li><Link href="/what-is-nodea">What is Nodea</Link></li>
            <li><Link href="/glossary">Glossary</Link></li>
            <li><Link href="/#how-it-works">How it works</Link></li>
            <li><Link href="/#features">Features</Link></li>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/upgrade">Pricing</Link></li>
            <li><Link href="/demo">Demo</Link></li>
          </ul>
        </div>

        <div className="ln-nav-actions">
          <button
            className="ln-theme-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/login" className="ln-btn ln-btn-ghost">Sign in</Link>
          <Link href="/login?mode=signup" className="ln-btn ln-btn-primary">Get started free</Link>
        </div>
      </div>
    </nav>
  )
}
