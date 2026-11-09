import { randomUUID } from 'crypto'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'chat-attachments'

// Cache the "bucket exists" check across requests in the same Node process.
// Buckets persist, so once we've seen it we don't need to check again.
let bucketEnsured = false

async function ensureBucket(admin: ReturnType<typeof createServiceSupabaseClient>) {
  if (bucketEnsured || !admin) return
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 35 * 1024 * 1024,
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain', 'text/csv', 'text/markdown', 'application/json',
      ],
    })
  }
  bucketEnsured = true
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createServiceSupabaseClient()
  if (!admin) return new Response('Server misconfigured', { status: 500 })

  try {
    await ensureBucket(admin)
  } catch (err) {
    console.error('ensureBucket failed', err)
    return Response.json({ error: 'Storage unavailable' }, { status: 500 })
  }

  const { name, type, dataUrl } = await req.json() as {
    name?:    string
    type?:    string
    dataUrl?: string
  }

  if (!name || !type || !dataUrl?.startsWith('data:')) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const base64 = dataUrl.split(',')[1]
  if (!base64) return Response.json({ error: 'Empty data' }, { status: 400 })
  const bytes = Buffer.from(base64, 'base64')

  // Path is unguessable (UUID) but in the user's own subtree, so even though
  // the bucket is public no one can enumerate another user's uploads.
  const safeBase = name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64) || 'file'
  const path = `${user.id}/${randomUUID()}-${safeBase}`

  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: type,
    upsert: false,
  })
  if (error) {
    console.error('upload failed', error)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
  return Response.json({ url: pub.publicUrl, name, type })
}
