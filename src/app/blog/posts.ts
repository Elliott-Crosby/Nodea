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
  {
    slug: 'fork-chatgpt-conversation',
    title: 'How to Fork a ChatGPT Conversation (and When the Workarounds Break Down)',
    description:
      'Step-by-step instructions for the three main ways to branch a ChatGPT or Claude conversation — the edit trick, the regenerate trick, and duplicate tabs — plus exactly where each one fails.',
    category: 'Guide',
    readMinutes: 8,
    publishedAt: '2026-05-22',
    keywords: [
      'fork ChatGPT conversation',
      'branch ChatGPT conversation',
      'ChatGPT edit message',
      'ChatGPT conversation variants',
      'duplicate ChatGPT chat',
      'ChatGPT branching',
    ],
  },
  {
    slug: 'tree-of-thought-prompting',
    title: 'Tree of Thought Prompting: What It Is, How to Use It, and Why Your Interface Matters',
    description:
      'A practical guide to Tree of Thought prompting — the technique, how it differs from chain-of-thought, when it outperforms step-by-step reasoning, and why most chat interfaces get in the way.',
    category: 'Guide',
    readMinutes: 7,
    publishedAt: '2026-05-22',
    keywords: [
      'tree of thought prompting',
      'tree of thoughts AI',
      'ToT prompting',
      'chain of thought vs tree of thought',
      'tree of thought technique',
      'advanced prompting',
    ],
  },
  {
    slug: 'compare-ai-model-outputs',
    title: 'How to Compare AI Model Outputs Side by Side',
    description:
      'A practical method for running honest A/B comparisons between Claude, ChatGPT, and other models — prompt design, what to actually measure, and the tools that make parallel comparison tractable.',
    category: 'Guide',
    readMinutes: 6,
    publishedAt: '2026-05-22',
    keywords: [
      'compare AI models',
      'Claude vs ChatGPT comparison',
      'AI model comparison',
      'test AI models side by side',
      'compare AI responses',
      'ChatGPT alternative comparison',
    ],
  },
]

export function getPost(slug: string): PostMeta | undefined {
  return POSTS.find((p) => p.slug === slug)
}
