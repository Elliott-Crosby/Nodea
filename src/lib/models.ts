export const MODELS = {
  haiku:        'claude-haiku-4-5-20251001',
  sonnet:       'claude-sonnet-5',
  opus:         'claude-opus-4-7',
} as const

const MODEL_LABELS: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'claude-sonnet-5':           'Sonnet',
  'claude-sonnet-4-6':         'Sonnet', // historical nodes from the 4.6 era
  'claude-opus-4-7':           'Opus',
}

export function modelDisplayName(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId
}

// Signals that the request likely needs deeper reasoning
const COMPLEX_RE = /\b(code|debug|implement|refactor|architect|algorithm|optimize|analyz|analys|compare|review|write|create|build|design|explain|difference between|pros and cons|how does|step[- ]by[- ]step)\b/i

// Sonnet 5 is the baseline for every chat message — free users included. The
// free product must not be a weaker Claude than claude.ai's free tier (that
// was the #1 retention blocker: externals were served ~93% Haiku). Haiku
// stays the workhorse for utility routes (titles, search, summaries, memory
// extraction, the public demo), which import MODELS.haiku directly.
//
// Opus is the Pro upgrade for messages that look like real work. The trigger
// is deliberately generous (word bound lowered 100 → 60): Opus usage was
// near-zero, and a Pro tier that visibly escalates to Opus is most of its
// pitch. Cost stays bounded by the Pro daily cap, not by stinginess here.
export function selectChatModel(isPro: boolean, lastMessage: string): string {
  const words     = lastMessage.trim().split(/\s+/).length
  const isComplex = words > 60 || COMPLEX_RE.test(lastMessage)

  if (isPro && isComplex) return MODELS.opus
  return MODELS.sonnet
}

// Web search is only available on Sonnet and Opus, not Haiku
export function supportsWebSearch(modelId: string): boolean {
  return modelId === MODELS.sonnet || modelId === MODELS.opus
}
