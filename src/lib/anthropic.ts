import { createAnthropic } from '@ai-sdk/anthropic'

// Explicit baseURL — the Vercel AI SDK provider appends "/messages" directly
// to whatever ANTHROPIC_BASE_URL holds, so any OS-level env var missing the
// "/v1" segment (common when set for the official Anthropic SDK, which adds
// it automatically) silently breaks every chat request.
export const anthropic = createAnthropic({
  baseURL: 'https://api.anthropic.com/v1',
})
