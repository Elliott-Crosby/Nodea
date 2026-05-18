import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { after } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkTokenLimits, recordTokenUsage, estimateTokens } from '@/lib/token-limits'

const MODEL_ID = 'claude-sonnet-4-6'

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

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json() as { messages: IncomingMessage[] }

  const validMessages = messages.filter(msg => (msg.content ?? '').trim() || (msg.attachments ?? []).length > 0)

  const inputText      = validMessages.map(m => m.content ?? '').join(' ')
  const estimatedInput = estimateTokens(inputText)

  const limitCheck = await checkTokenLimits(user.id, estimatedInput, supabase)
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

  const modelMessages = validMessages.map((msg) => {
    const images = (msg.attachments ?? []).filter(a => a.type.startsWith('image/'))
    if (!images.length || msg.role !== 'user') {
      return { role: msg.role as 'user' | 'assistant', content: msg.content ?? '' }
    }
    return {
      role: 'user' as const,
      content: [
        ...images.map(a => ({ type: 'image' as const, image: a.dataUrl })),
        { type: 'text' as const, text: msg.content ?? '' },
      ],
    }
  })

  try {
    const encoder = new TextEncoder()
    const result  = streamText({
      model:    anthropic(MODEL_ID),
      system:   'You are a helpful AI assistant.',
      messages: modelMessages,
    })

    const userId = user.id

    // `after` runs after the response is fully sent, with the request context
    // (cookies/auth) still active — the only reliable place to write to Supabase
    // from a streaming route handler.
    after(async () => {
      try {
        const usage = await result.usage
        await recordTokenUsage(userId, usage.inputTokens ?? 0, usage.outputTokens ?? 0, supabase)
      } catch (err) {
        console.error('[token-limits] after() recording failed:', err)
      }
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
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('Chat route error:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}
