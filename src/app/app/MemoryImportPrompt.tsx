'use client'

import { useEffect, useState } from 'react'
import MemoryImportModal from './MemoryImportModal'
import { WHATS_NEW_DISMISSED_KEY } from './WhatsNewNotice'
import { lastChanceShowsToday } from '@/lib/lastChance'

// First-load memory-import prompt: shows once the use-case survey is answered,
// keeps re-asking every 7 days ("Maybe later") until the user either imports
// or says they don't use memory. Sequencing is data-driven — the API reports
// surveyPending so this never stacks on the survey popup, and a not-yet-
// consented account sees the ConsentGate first (this prompt bails for the
// session and asks on the next load).

const SNOOZE_KEY = 'nodea_memimport_snooze_until'
const SNOOZE_DAYS = 7

export default function MemoryImportPrompt() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // The last-chance campaign popup owns any load it shows on; this prompt
    // resumes once it's been dismissed for the day (or the campaign ends).
    if (lastChanceShowsToday()) return
    try {
      // The what's-new popup gets the first load to itself; this prompt
      // resumes on the next load after it's dismissed.
      if (localStorage.getItem(WHATS_NEW_DISMISSED_KEY) !== '1') return
      const until = Number(localStorage.getItem(SNOOZE_KEY) ?? '0')
      if (until > Date.now()) return
    } catch { /* storage unavailable → just ask */ }

    let cancelled = false
    void (async () => {
      try {
        const consent = await fetch('/api/consent').then(r => (r.ok ? r.json() : null))
        if (!consent?.termsAccepted) return // ConsentGate owns this load
        const state = await fetch('/api/memory-import').then(r => (r.ok ? r.json() : null))
        if (cancelled || !state) return
        if (!state.imported && !state.surveyPending) setOpen(true)
      } catch { /* fail quiet — this is a nudge, never a blocker */ }
    })()
    return () => { cancelled = true }
  }, [])

  if (!open) return null

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000))
    } catch { /* ignore */ }
    setOpen(false)
  }

  return (
    <MemoryImportModal
      skippable
      onClose={snooze}
      onSkip={snooze}
      onNothingToImport={() => setOpen(false)}
      onDone={() => setOpen(false)}
    />
  )
}
