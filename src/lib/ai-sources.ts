export interface AISource {
  key: string
  name: string
  /** Path relative to public/ — use as <img src={logo}> */
  logo: string
  /** Primary brand hex, useful for tinting or accent */
  color: string
}

export const AI_SOURCES: Record<string, AISource> = {
  claude:     { key: 'claude',     name: 'Claude',      logo: '/models/claude.svg',     color: '#D97757' },
  chatgpt:    { key: 'chatgpt',    name: 'ChatGPT',     logo: '/models/chatgpt.svg',    color: '#000000' },
  gemini:     { key: 'gemini',     name: 'Gemini',      logo: '/models/gemini.svg',     color: '#4285F4' },
  perplexity: { key: 'perplexity', name: 'Perplexity',  logo: '/models/perplexity.svg', color: '#20C997' },
  grok:       { key: 'grok',       name: 'Grok',        logo: '/models/grok.svg',       color: '#000000' },
  copilot:    { key: 'copilot',    name: 'Copilot',     logo: '/models/copilot.svg',    color: '#0078D4' },
  meta:       { key: 'meta',       name: 'Meta AI',     logo: '/models/meta.svg',       color: '#0082FB' },
  mistral:    { key: 'mistral',    name: 'Mistral',     logo: '/models/mistral.svg',    color: '#FF7000' },
  deepseek:   { key: 'deepseek',   name: 'DeepSeek',    logo: '/models/deepseek.svg',   color: '#4D6BFE' },
}

export function getAISource(key: string | null | undefined): AISource | null {
  if (!key) return null
  return AI_SOURCES[key] ?? null
}
