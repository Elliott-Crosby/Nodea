'use client'

import App from './App'
import ConsentGate from './ConsentGate'
import MemoryImportPrompt from './MemoryImportPrompt'
import WhatsNewNotice from './WhatsNewNotice'

export default function AppPage() {
  return (
    <>
      <App />
      <MemoryImportPrompt />
      <WhatsNewNotice />
      <ConsentGate />
    </>
  )
}
