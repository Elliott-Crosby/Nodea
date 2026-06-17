// Shared conversation → Markdown export. Used by the in-chat top-bar button and
// the Settings modal so both stay in sync and both strip the inline attachment
// marker that prefixes user content (never leak the raw `<<<NODEA_ATT_V1 …`).

const ATT_MARK_OPEN = '<<<NODEA_ATT_V1\n'
const ATT_MARK_CLOSE = '\nNODEA_ATT_V1>>>\n'

export function stripAttachmentMarker(content: string): string {
  if (!content.startsWith(ATT_MARK_OPEN)) return content
  const idx = content.indexOf(ATT_MARK_CLOSE, ATT_MARK_OPEN.length)
  return idx < 0 ? content : content.slice(idx + ATT_MARK_CLOSE.length)
}

export interface ExportMessage {
  role: 'user' | 'assistant'
  content: string
}

export function buildConversationMarkdown(name: string, messages: ExportMessage[]): string {
  const lines: string[] = [`# ${name || 'Conversation'}`, '']
  for (const msg of messages) {
    lines.push(`**${msg.role === 'user' ? 'You' : 'Claude'}:**`)
    lines.push(stripAttachmentMarker(msg.content))
    lines.push('')
  }
  return lines.join('\n')
}

// Builds the Markdown and triggers a browser download. Client-only (uses `Blob`,
// `URL`, and `document`).
export function downloadConversationMarkdown(name: string, messages: ExportMessage[]): void {
  const blob = new Blob([buildConversationMarkdown(name, messages)], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(name || 'conversation').replace(/[^a-z0-9]/gi, '_')}.md`
  a.click()
  URL.revokeObjectURL(url)
}
