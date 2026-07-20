import { getEarlyBirdStatus } from '@/lib/earlyBirdServer'

export async function GET() {
  const status = await getEarlyBirdStatus()
  return Response.json(status, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
