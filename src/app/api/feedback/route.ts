import { collectFeedback } from '@/lib/shutdown-feedback'

export const runtime = 'nodejs'
export const maxDuration = 15
export const POST = collectFeedback
