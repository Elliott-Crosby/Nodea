'use client'

import { useTheme } from '@/lib/theme'
import { Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import { NAV_LINKS } from './navLinks'

export default function Nav() {
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="ln-nav">
      <div className="ln-container">
        <div className="ln-nav-left">
          <Link href="/" className="ln-wordmark">Nodea</Link>

          <ul className="ln-nav-links">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}><Link href={href}>{label}</Link></li>
            ))}
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
