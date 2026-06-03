import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!projects?.length) {
    const { data: newProject, error: createError } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: 'My First Project' })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    projects = newProject ? [newProject] : []
  }

  return NextResponse.json({ projects, project: projects[0] })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    name,
    source,
    source_conversation_id,
    source_org_id,
    source_leaf_id,
    source_synced_at,
  } = body

  // Build the row, only including provenance columns when present so that
  // pre-migration databases (which lack these columns) keep working.
  const row: Record<string, unknown> = { user_id: user.id, name: name || 'New Project' }
  if (source != null)                   row.source                   = source
  if (source_conversation_id != null)   row.source_conversation_id   = source_conversation_id
  if (source_org_id != null)            row.source_org_id            = source_org_id
  if (source_leaf_id != null)           row.source_leaf_id           = source_leaf_id
  if (source_synced_at != null)         row.source_synced_at         = source_synced_at

  let { data: project, error } = await supabase
    .from('projects')
    .insert(row)
    .select()
    .single()

  // If the insert failed because the provenance columns don't exist yet
  // (pre-migration DB — error code 42703 / PGRST204), retry with just name.
  // The client-side UPDATE will still attempt to write provenance afterwards.
  const isColumnError = (e: { code?: string } | null) =>
    e?.code === '42703' || e?.code === 'PGRST204'

  if (error && isColumnError(error)) {
    ;({ data: project, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: name || 'New Project' })
      .select()
      .single())
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project })
}
