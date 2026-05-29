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
