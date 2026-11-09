import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { notifyAdmin } from '@/lib/email'

// Founder daily digest — "a place to receive that info" for signups and
// activity. Runs via Vercel cron (vercel.json, 12:00 UTC ≈ 8am ET); Stripe
// subscribe/cancel events already notify instantly from the webhook, so this
// covers the Supabase side: who signed up, who was actually active.
//
// Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations when the CRON_SECRET env var is set. Requests without it are
// rejected so the route can't be triggered (or spammed) publicly.

export const maxDuration = 60

interface AdminUser {
  id: string
  email?: string
  created_at: string
  last_sign_in_at?: string | null
}

async function listAllUsers(): Promise<AdminUser[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  const users: AdminUser[] = []
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (!r.ok) break
    const j = (await r.json()) as { users?: AdminUser[] }
    const batch = j.users ?? []
    users.push(...batch)
    if (batch.length < 100) break
  }
  return users
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceSupabaseClient()
  if (!service) return Response.json({ error: 'Service client unavailable' }, { status: 500 })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const users = await listAllUsers()
  const newUsers = users
    .filter(u => u.created_at >= since)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  // Active users = anyone whose conversations gained a message in the window.
  const { data: newNodes } = await service
    .from('nodes')
    .select('project_id')
    .gte('created_at', since)
  const projectIds = [...new Set((newNodes ?? []).map(n => n.project_id as string))]
  let activeEmails: string[] = []
  if (projectIds.length > 0) {
    const { data: projects } = await service
      .from('projects')
      .select('user_id')
      .in('id', projectIds.slice(0, 500))
    const activeIds = new Set((projects ?? []).map(p => p.user_id as string))
    const byId = new Map(users.map(u => [u.id, u.email ?? u.id]))
    activeEmails = [...activeIds].map(id => byId.get(id) ?? id)
  }

  const lines: string[] = [
    `New signups (24h): ${newUsers.length}`,
    ...newUsers.slice(0, 25).map(u => `  • ${u.email ?? '(anonymous)'}`),
    '',
    `Users who sent messages (24h): ${activeEmails.length}`,
    ...activeEmails.slice(0, 25).map(e => `  • ${e}`),
    '',
    `Messages created (24h): ${(newNodes ?? []).length}`,
    `Total accounts: ${users.length}`,
  ]

  const result = await notifyAdmin(
    `📊 Nodea digest — ${newUsers.length} signup${newUsers.length === 1 ? '' : 's'}, ${activeEmails.length} active`,
    lines,
  )

  return Response.json({ ok: true, emailed: result.sent, newUsers: newUsers.length, active: activeEmails.length })
}
