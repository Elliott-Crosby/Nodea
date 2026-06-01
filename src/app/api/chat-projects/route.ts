import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  isProUser,
  VALID_COLOR_IDS,
  VALID_ICON_KEYS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_PINNED_PROJECTS,
} from '@/lib/chat-projects'

// ─────────────────────────────────────────────────────────────────────────────
// /api/chat-projects
// GET   — list the user's chat_projects, with chat counts and last activity.
// POST  — create a new chat_project (Pro only).
// ─────────────────────────────────────────────────────────────────────────────

// Shape of the row returned to the client. Counts/activity are computed —
// they don't live on the row itself.
export interface ChatProjectListItem {
  id: string
  name: string
  description: string
  memory: string
  icon: string
  color: string
  pinned: boolean
  created_at: string
  updated_at: string
  chat_count: number
  last_activity: string | null
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: projects, error } = await supabase
    .from('chat_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[chat-projects:list]', error.code, error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Pull the chat-to-project mapping for this user in one query, then
  // fold into per-project chat_count + last_activity (= max created_at).
  // The legacy `projects` table here actually stores conversations.
  const { data: conversations, error: convErr } = await supabase
    .from('projects')
    .select('id, chat_project_id, created_at')
    .eq('user_id', user.id)
    .not('chat_project_id', 'is', null)

  if (convErr) {
    console.error('[chat-projects:list-convs]', convErr.code, convErr.message)
  }

  const stats = new Map<string, { count: number; last: string | null }>()
  for (const c of conversations ?? []) {
    const pid = (c as { chat_project_id: string | null }).chat_project_id
    if (!pid) continue
    const ts = (c as { created_at: string }).created_at
    const cur = stats.get(pid) ?? { count: 0, last: null }
    cur.count += 1
    if (!cur.last || ts > cur.last) cur.last = ts
    stats.set(pid, cur)
  }

  const enriched: ChatProjectListItem[] = (projects ?? []).map((p) => {
    const s = stats.get(p.id)
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      memory: p.memory ?? '',
      icon: p.icon,
      color: p.color,
      pinned: p.pinned,
      created_at: p.created_at,
      updated_at: p.updated_at,
      chat_count: s?.count ?? 0,
      last_activity: s?.last ?? null,
    }
  })

  return NextResponse.json({ projects: enriched })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isProUser(user.id, supabase))) {
    return NextResponse.json({ error: 'pro_required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string
    description?: string
    icon?: string
    color?: string
    pinned?: boolean
  }

  const name = String(body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'name_too_long', max: MAX_NAME_LENGTH }, { status: 400 })
  }

  const description = String(body.description ?? '').trim()
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ error: 'description_too_long', max: MAX_DESCRIPTION_LENGTH }, { status: 400 })
  }

  const icon = String(body.icon ?? 'sparkle')
  if (!VALID_ICON_KEYS.has(icon)) {
    return NextResponse.json({ error: 'invalid_icon' }, { status: 400 })
  }

  const color = String(body.color ?? 'violet')
  if (!VALID_COLOR_IDS.has(color)) {
    return NextResponse.json({ error: 'invalid_color' }, { status: 400 })
  }

  // Auto-pin if the user hasn't hit their pin cap yet. Caller may force
  // an unpinned state with explicit `pinned: false`. We never auto-unpin
  // an existing project to make room — that's an explicit user action.
  let pinned = false
  if (body.pinned !== false) {
    const { count: pinnedCount } = await supabase
      .from('chat_projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('pinned', true)
    pinned = (pinnedCount ?? 0) < MAX_PINNED_PROJECTS
  }

  const { data: project, error } = await supabase
    .from('chat_projects')
    .insert({
      user_id: user.id,
      name,
      description,
      icon,
      color,
      pinned,
    })
    .select()
    .single()

  if (error) {
    console.error('[chat-projects:create]', error.code, error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }

  return NextResponse.json({
    project: {
      ...project,
      chat_count: 0,
      last_activity: null,
    } satisfies ChatProjectListItem,
  })
}
