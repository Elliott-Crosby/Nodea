import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const MODEL_MAP: Record<string, string> = {
  auto:   'claude-haiku-4-5-20251001',
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20251001',
  opus:   'claude-opus-4-5-20251001',
}

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

  const { messages, model = 'auto' } = await req.json() as { messages: IncomingMessage[]; model: string }

  const modelId = MODEL_MAP[model] ?? MODEL_MAP.auto

  const modelMessages = messages.map((msg) => {
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

  const encoder = new TextEncoder()
  const result = streamText({
    model: anthropic(modelId),
    system: 'You are a helpful AI assistant.',
    messages: modelMessages,
  })

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(chunk))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
