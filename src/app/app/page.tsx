'use client'

import App from './App'
import ConsentGate from './ConsentGate'
import LastChancePopup from './LastChancePopup'
import MemoryImportPrompt from './MemoryImportPrompt'
import WhatsNewNotice from './WhatsNewNotice'

export default function AppPage() {
  return (
    <>
      <App />
      <LastChancePopup />
      <MemoryImportPrompt />
      <WhatsNewNotice />
      <ConsentGate />
    </>
  )
}
