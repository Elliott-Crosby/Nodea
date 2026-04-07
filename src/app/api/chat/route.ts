import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const modelMessages = messages.map(({ role, content }: { role: string; content: string }) => ({
    role,
    content,
  }))

  const encoder = new TextEncoder()
  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
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
