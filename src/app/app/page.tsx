'use client'

import App from './App'
import ConsentGate from './ConsentGate'
import MemoryImportPrompt from './MemoryImportPrompt'

export default function AppPage() {
  return (
    <>
      <App />
      <MemoryImportPrompt />
      <ConsentGate />
    </>
  )
}
