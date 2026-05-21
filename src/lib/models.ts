export const MODELS = {
  haiku:        'claude-haiku-4-5-20251001',
  sonnet:       'claude-sonnet-4-6',
  opus:         'claude-opus-4-7',
  haikuLegacy:  'claude-3-haiku-20240307',
} as const

const MODEL_LABELS: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'claude-sonnet-4-6':         'Sonnet',
  'claude-opus-4-7':           'Opus',
  'claude-3-haiku-20240307':   'Haiku',
}

export function modelDisplayName(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId
}

// Signals that the request likely needs deeper reasoning
const COMPLEX_RE = /\b(code|debug|implement|refactor|architect|algorithm|optimize|analyz|analys|compare|review|write|create|build|design|explain|difference between|pros and cons|how does|step[- ]by[- ]step)\b/i

export function selectChatModel(isPro: boolean, lastMessage: string): string {
  const words    = lastMessage.trim().split(/\s+/).length
  const isComplex = words > 100 || COMPLEX_RE.test(lastMessage)

  if (isPro) {
    // Pro: Haiku → Sonnet → Opus depending on complexity
    return isComplex ? MODELS.opus : MODELS.sonnet
  }

  // Free: Haiku for simple, Sonnet for complex — Opus is pro-only
  return isComplex ? MODELS.sonnet : MODELS.haiku
}

// Web search is only available on Sonnet and Opus, not Haiku
export function supportsWebSearch(modelId: string): boolean {
  return modelId === MODELS.sonnet || modelId === MODELS.opus
}
