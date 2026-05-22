export interface PostMeta {
  slug: string
  title: string
  description: string
  category: 'Pillar' | 'Essay' | 'Field note' | 'Guide'
  readMinutes: number
  publishedAt: string
  updatedAt?: string
  keywords: string[]
}

export const POSTS: PostMeta[] = [
  {
    slug: 'branching-ai-chat-guide',
    title: 'Branching AI Chat: The Complete Guide to Non-Linear Conversations with Claude and ChatGPT',
    description:
      'A definitive guide to branching AI chat: what it is, why linear chatbots fail at exploration, how to fork ChatGPT and Claude conversations, and the tools that make tree-shaped conversations possible.',
    category: 'Pillar',
    readMinutes: 14,
    publishedAt: '2026-05-22',
    keywords: [
      'branching AI chat',
      'fork ChatGPT conversation',
      'tree of thought AI',
      'non-linear AI chat',
      'Claude conversation branching',
      'ChatGPT alternative',
    ],
  },
]

export function getPost(slug: string): PostMeta | undefined {
  return POSTS.find((p) => p.slug === slug)
}
