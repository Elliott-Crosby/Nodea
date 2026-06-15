'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/lib/theme'
import { Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { NAV_LINKS } from './navLinks'

export default function Nav() {
  const { theme, toggleTheme } = useTheme()
  // null = unknown (still checking). Most visitors are signed out, so we render
  // the signed-out CTAs until we learn otherwise to avoid a layout flash.
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setAuthed(!!session?.user)
    )
    return () => sub.subscription.unsubscribe()
  }, [])

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
          {authed ? (
            <Link href="/app" className="ln-btn ln-btn-primary">Open canvas</Link>
          ) : (
            <>
              <Link href="/login" className="ln-btn ln-btn-ghost">Sign in</Link>
              <Link href="/login?mode=signup" className="ln-btn ln-btn-primary">Get started free</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
