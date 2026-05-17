import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const MODEL_ID = 'claude-sonnet-4-5-20251001'

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
    model: anthropic(MODEL_ID),
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
