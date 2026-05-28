import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { anthropic } from '@/lib/anthropic'
import { MODELS } from '@/lib/models'

export const MAX_MEMORY_ENTRIES   = 30
export const MAX_MEMORY_LENGTH    = 300
export const MAX_PER_EXCHANGE     = 3   // ceiling on new memories per Haiku pass

export interface UserMemory {
  id:         string
  user_id:    string
  content:    string
  source:     'auto' | 'manual'
  created_at: string
  updated_at: string
}

export async function loadUserMemories(
  userId: string,
  supabase: SupabaseClient,
): Promise<UserMemory[]> {
  const { data, error } = await supabase
    .from('user_memories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(MAX_MEMORY_ENTRIES)
  if (error) {
    console.warn('[memory] load failed', error.code, error.message)
    return []
  }
  return (data ?? []) as UserMemory[]
}

// Returns the block appended to the chat system prompt. Empty if no memories.
export function formatMemoryBlock(memories: UserMemory[]): string {
  if (memories.length === 0) return ''
  const lines = memories.map((m) => `- ${m.content}`).join('\n')
  return (
    `\n\nWhat you know about the user from previous conversations:\n${lines}\n` +
    `Use these facts naturally if relevant. Do not list them back unless asked.`
  )
}

const EXTRACT_SYSTEM = [
  'You extract long-term memories about the user from a chat exchange.',
  'Only output stable facts about the USER themselves: their name, role, interests, ongoing projects, preferences, constraints.',
  'Do NOT extract: one-off questions, generic curiosities, facts about third parties, anything the assistant said, transient state like "is debugging X today".',
  `Each memory must be a single sentence in third person, under ${MAX_MEMORY_LENGTH} characters, starting with "User".`,
  'Skip anything already covered by existing memories.',
  'Reply with JSON only — no markdown fences. Format: {"memories": ["...", "..."]}. If nothing is worth saving, reply {"memories": []}.',
].join(' ')

export async function extractMemoriesFromExchange(
  userMessage:    string,
  assistantReply: string,
  existing:       UserMemory[],
): Promise<string[]> {
  const existingList = existing.length
    ? existing.map((m) => `- ${m.content}`).join('\n')
    : '(none yet)'

  try {
    const { text } = await generateText({
      model:  anthropic(MODELS.haiku),
      system: EXTRACT_SYSTEM,
      prompt:
        `Existing memories:\n${existingList}\n\n` +
        `Exchange:\nUser: ${userMessage.slice(0, 1500)}\n` +
        `Assistant: ${assistantReply.slice(0, 1500)}`,
    })

    const clean = text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')

    const parsed = JSON.parse(clean) as { memories?: unknown }
    const raw    = Array.isArray(parsed.memories) ? parsed.memories : []

    return raw
      .map((s) => String(s ?? '').trim())
      .filter((s) => s.length > 0 && s.length <= MAX_MEMORY_LENGTH)
      .slice(0, MAX_PER_EXCHANGE)
  } catch (err) {
    console.warn('[memory] extract failed', err)
    return []
  }
}

// Lowercase, alphanumeric-only form for cheap dupe detection.
function normalize(content: string): string {
  return content.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function dedupAgainstExisting(
  candidates: string[],
  existing:   UserMemory[],
): string[] {
  const seen = new Set(existing.map((m) => normalize(m.content)))
  const out: string[] = []
  for (const c of candidates) {
    const n = normalize(c)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(c)
  }
  return out
}
