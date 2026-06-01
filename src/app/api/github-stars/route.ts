import { NextResponse } from 'next/server'

// The public Nodea repo (also referenced in the Organization schema in layout.tsx).
const REPO = 'Elliott-Crosby/Nodea'

/** 1234 → "1.2k", 12500 → "12.5k", 999 → "999". */
function formatStars(n: number): string {
  if (n < 1000) return String(n)
  return `${Math.round(n / 100) / 10}k`
}

export async function GET() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        // GitHub's API rejects requests without a User-Agent.
        'User-Agent': 'nodea-landing',
      },
      // Server-side Data Cache: GitHub is hit at most once an hour, regardless
      // of how many visitors load the page (unauthenticated limit is 60/hour).
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json({ stars: null, formatted: null })
    }

    const data = await res.json()
    const stars = typeof data.stargazers_count === 'number' ? data.stargazers_count : null

    return NextResponse.json(
      { stars, formatted: stars === null ? null : formatStars(stars) },
      // Let the CDN serve the JSON too, so most loads never invoke the function.
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    )
  } catch {
    return NextResponse.json({ stars: null, formatted: null })
  }
}
