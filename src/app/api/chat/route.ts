import { streamText } from 'ai'
import { anthropic } from '@/lib/anthropic'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { checkTokenLimits, recordTokenUsage, estimateTokens } from '@/lib/token-limits'
import { isAdmin } from '@/lib/admin'
import { selectChatModel, supportsWebSearch } from '@/lib/models'
import { loadUserMemories, formatMemoryBlock } from '@/lib/memory'

const BASE_SYSTEM_PROMPT =
  'You are a concise, helpful assistant. Match your response length to the complexity of the question — short questions get short answers, detailed questions get detailed answers. Use plain prose. Avoid emojis, unnecessary headers, and bullet lists unless structure genuinely helps clarity.'

interface Attachment {
  name: string
  type: string
  dataUrl: string
}

interface IncomingMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
}

// Resolve an attachment's `dataUrl` (either a `data:` URL or an https URL
// from Supabase Storage) into raw base64 + mediaType. We fetch URLs server-
// side rather than passing them through to Anthropic because:
//   • Anthropic's url-source image input is unreliable (rejects small or
//     unusual images with "Could not process image" / "Unable to download").
//   • The fetched body is on the server side, so the 4.5 MB Vercel POST cap
//     doesn't apply between Vercel and Anthropic.
async function resolveAttachmentData(
  dataUrl: string,
  declaredType: string,
): Promise<{ base64: string; mediaType: string } | null> {
  if (dataUrl.startsWith('data:')) {
    const base64 = dataUrl.split(',')[1] ?? ''
    return base64 ? { base64, mediaType: declaredType } : null
  }
  if (/^https?:\/\//i.test(dataUrl)) {
    try {
      const r = await fetch(dataUrl)
      if (!r.ok) return null
      const buf = Buffer.from(await r.arrayBuffer())
      const ct = r.headers.get('content-type')?.split(';')[0]?.trim()
      return { base64: buf.toString('base64'), mediaType: ct || declaredType }
    } catch {
      return null
    }
  }
  return null
}

async function buildUserContent(msg: IncomingMessage) {
  const attachments = msg.attachments ?? []
  if (!attachments.length) return msg.content ?? ''

  const parts: Array<
    | { type: 'file'; data: string; mediaType: string; filename: string }
    | { type: 'text'; text: string }
  > = []

  for (const a of attachments) {
    if (!a.dataUrl) continue

    if (a.type.startsWith('image/') || a.type === 'application/pdf') {
      const resolved = await resolveAttachmentData(a.dataUrl, a.type)
      if (!resolved) continue
      parts.push({ type: 'file', data: resolved.base64, mediaType: resolved.mediaType, filename: a.name })
    } else if (a.type.startsWith('text/') || a.type === 'application/json') {
      const resolved = await resolveAttachmentData(a.dataUrl, a.type)
      if (!resolved) continue
      const text = Buffer.from(resolved.base64, 'base64').toString('utf-8')
      parts.push({ type: 'text', text: `[File: ${a.name}]\n\`\`\`\n${text}\n\`\`\`` })
    }
  }

  if (msg.content?.trim()) parts.push({ type: 'text', text: msg.content })
  return parts
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json() as { messages: IncomingMessage[] }

  const validMessages = messages.filter(msg => (msg.content ?? '').trim() || (msg.attachments ?? []).length > 0)

  const inputText      = validMessages.map(m => m.content ?? '').join(' ')
  const estimatedInput = estimateTokens(inputText)

  const admin = await isAdmin(user.id, supabase)

  let isPro = admin
  if (!admin) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle()
    isPro = profile?.plan === 'pro'
  }

  const limitCheck = await checkTokenLimits(user.id, estimatedInput, supabase, admin, isPro)
  if (!limitCheck.allowed) {
    return Response.json(
      {
        error:        'rate_limit_exceeded',
        limit_type:   limitCheck.limit_type,
        resets_at:    limitCheck.resets_at,
        tokens_used:  limitCheck.tokens_used,
        tokens_limit: limitCheck.tokens_limit,
      },
      { status: 429 },
    )
  }

  const lastUserMessage = [...validMessages].reverse().find(m => m.role === 'user')?.content ?? ''
  const modelId = selectChatModel(isPro, lastUserMessage)

  // Cross-chat memory is a Pro feature. Loaded inline so it's available
  // immediately — fast (one indexed query) and small (<= 30 short rows).
  const memoryBlock = isPro
    ? formatMemoryBlock(await loadUserMemories(user.id, supabase))
    : ''
  const systemPrompt = BASE_SYSTEM_PROMPT + memoryBlock

  const modelMessages = await Promise.all(validMessages.map(async (msg) => {
    if (msg.role !== 'user') {
      return { role: 'assistant' as const, content: msg.content ?? '' }
    }
    return { role: 'user' as const, content: await buildUserContent(msg) }
  }))

  try {
    const encoder  = new TextEncoder()
    const userId   = user.id
    // Service-role client bypasses RLS and request-context auth — reliable for
    // server-side writes inside stream callbacks where cookies may be unavailable.
    const writeClient = createServiceSupabaseClient() ?? supabase

    const tools = supportsWebSearch(modelId)
      ? { web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }) }
      : undefined

    const result = streamText({
      model:    anthropic(modelId),
      system:   systemPrompt,
      messages: modelMessages,
      ...(tools ? { tools } : {}),
      // onFinish fires after the stream is fully consumed, with real token counts.
      // This is the correct hook vs after()+result.usage, which races the stream.
      onFinish: async ({ totalUsage }) => {
        try {
          await recordTokenUsage(
            userId,
            totalUsage.inputTokens ?? 0,
            totalUsage.outputTokens ?? 0,
            writeClient,
          )
        } catch (err) {
          console.error('[token-limits] onFinish recording failed:', err)
        }
      },
    })

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        } catch (streamErr) {
          console.error('Stream error:', streamErr)
          controller.error(streamErr)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Model-Id':   modelId,
      },
    })
  } catch (err) {
    console.error('Chat route error:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}
