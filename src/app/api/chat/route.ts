import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { checkTokenLimits, recordTokenUsage, estimateTokens } from '@/lib/token-limits'
import { isAdmin } from '@/lib/admin'
import { selectChatModel, supportsWebSearch } from '@/lib/models'

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

function buildUserContent(msg: IncomingMessage) {
  const attachments = msg.attachments ?? []
  if (!attachments.length) return msg.content ?? ''

  const parts: Array<
    | { type: 'image'; image: string }
    | { type: 'file'; data: string; mediaType: string; filename: string }
    | { type: 'text'; text: string }
  > = []

  for (const a of attachments) {
    const base64 = a.dataUrl.split(',')[1] ?? ''

    if (a.type.startsWith('image/')) {
      parts.push({ type: 'image', image: a.dataUrl })
    } else if (a.type === 'application/pdf') {
      parts.push({ type: 'file', data: base64, mediaType: 'application/pdf', filename: a.name })
    } else if (a.type.startsWith('text/') || a.type === 'application/json') {
      const text = Buffer.from(base64, 'base64').toString('utf-8')
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

  const modelMessages = validMessages.map((msg) => {
    if (msg.role !== 'user') {
      return { role: 'assistant' as const, content: msg.content ?? '' }
    }
    return { role: 'user' as const, content: buildUserContent(msg) }
  })

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
      system:   'You are a concise, helpful assistant. Match your response length to the complexity of the question — short questions get short answers, detailed questions get detailed answers. Use plain prose. Avoid emojis, unnecessary headers, and bullet lists unless structure genuinely helps clarity.',
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
