import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

/**
 * Pro gating for the Chat Projects feature. Mirrors the same check used by
 * the cross-chat memory routes — admins are always Pro, others need plan='pro'.
 */
export async function isProUser(
  userId: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  if (await isAdmin(userId, supabase)) return true
  const { data } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.plan === 'pro'
}

// Server-side limits mirrored from the client (projectConstants.tsx). We
// validate again here so a tampered request can't bypass UI constraints.
export const MAX_PINNED_PROJECTS = 3
export const MAX_NAME_LENGTH = 80
export const MAX_DESCRIPTION_LENGTH = 280
// Project memory is longer-form context injected into the system prompt for the
// project's conversations — a more generous cap than the description blurb.
export const MAX_PROJECT_MEMORY_LENGTH = 2000

// The curated icon/color sets — kept here (not imported from the .tsx file)
// so server routes don't pull a React file into their bundle.
export const VALID_COLOR_IDS = new Set([
  'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet',
])

export const VALID_ICON_KEYS = new Set([
  'compass', 'book', 'code', 'flask', 'bulb', 'rocket', 'target',
  'briefcase', 'cap', 'chart', 'feather', 'layers', 'sparkle',
  'hexagon', 'atom', 'cube', 'leaf', 'bolt', 'globe', 'chat',
])

// ─── Project memory → system prompt ──────────────────────────────────────────
// The memory box on a chat_project is persistent context for the assistant.
// For a conversation filed under a project, we inject the project's memory into
// the system prompt (Pro-gated, mirroring cross-chat user_memories).

/**
 * Resolve the project memory for a given conversation. `conversationId` is a row
 * in the legacy `projects` table (= a conversation). Returns '' when the
 * conversation is unfiled, the project has no memory, or anything goes wrong —
 * the chat path must never break on this lookup.
 */
export async function loadProjectMemoryForConversation(
  conversationId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<string> {
  try {
    const { data: conv } = await supabase
      .from('projects')
      .select('chat_project_id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()
    const chatProjectId = (conv as { chat_project_id: string | null } | null)?.chat_project_id
    if (!chatProjectId) return ''

    const { data: proj } = await supabase
      .from('chat_projects')
      .select('memory')
      .eq('id', chatProjectId)
      .eq('user_id', userId)
      .maybeSingle()
    return (proj as { memory: string | null } | null)?.memory?.trim() ?? ''
  } catch (err) {
    console.warn('[chat-projects] project memory load failed', err)
    return ''
  }
}

/** The block appended to the chat system prompt. Empty when there's no memory. */
export function formatProjectMemoryBlock(memory: string): string {
  const trimmed = memory.trim()
  if (!trimmed) return ''
  return (
    `\n\nProject memory — context the user has set for this project. ` +
    `Treat it as background for this conversation; don't repeat it back unless asked:\n${trimmed}`
  )
}
