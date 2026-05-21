'use client'

import { useTheme } from '@/lib/theme'
import { Sun, Moon } from 'lucide-react'
import Link from 'next/link'

export default function Nav() {
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="ln-nav">
      <div className="ln-container">
        <Link href="/" className="ln-wordmark">Nodea</Link>

        <ul className="ln-nav-links">
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#blog">Blog</a></li>
          <li><Link href="/upgrade">Pricing</Link></li>
          <li><button type="button" aria-disabled="true" className="ln-btn-noop">Changelog<span className="ln-soon-pill">soon</span></button></li>
        </ul>

        <div className="ln-nav-actions">
          <button
            className="ln-theme-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/login" className="ln-btn ln-btn-ghost">Sign in</Link>
          <Link href="/login" className="ln-btn ln-btn-primary">Get started</Link>
        </div>
      </div>
    </nav>
  )
}
