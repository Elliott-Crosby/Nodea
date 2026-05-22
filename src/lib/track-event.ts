export function getSessionId(): string {
  const key = 'n_sid'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return ''
  }
}

export function trackEvent(name: string, props?: Record<string, unknown>): void {
  try {
    fetch('/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: name,
        session_id: getSessionId(),
        properties: props ?? null,
      }),
    }).catch(() => {})
  } catch {
    // fire-and-forget
  }
}
