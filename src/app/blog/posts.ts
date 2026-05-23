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
  {
    slug: 'never-lose-thinking',
    title: 'Never Lose a Train of Thought Again: Why Linear AI Chats Forget Your Best Ideas',
    description:
      'Why every promising tangent in a linear AI chat ends up buried or overwritten — and how a branching canvas keeps every line of thinking intact and addressable.',
    category: 'Essay',
    readMinutes: 8,
    publishedAt: '2026-05-22',
    keywords: [
      'never lose thinking',
      'save AI conversations',
      'AI chat history',
      'branching AI chat',
      'conversation tree',
      'preserve AI thinking',
    ],
  },
  {
    slug: 'organize-ai-like-your-brain',
    title: 'Organize AI Conversations the Way Your Brain Actually Works',
    description:
      'Human thinking branches; chat interfaces force it into a single line. A look at why tree-shaped conversations match the way ideas actually develop — and how to use them.',
    category: 'Essay',
    readMinutes: 9,
    publishedAt: '2026-05-22',
    keywords: [
      'organize AI conversations',
      'mind map AI',
      'non-linear thinking',
      'second brain AI',
      'AI workflow',
      'thinking in branches',
    ],
  },
  {
    slug: 'persistent-project-intelligence',
    title: 'Persistent Project Intelligence: Turning Scattered AI Chats Into a Living Knowledge Base',
    description:
      'How to make AI conversations accumulate value over weeks and months instead of dying with the tab — a workflow for long-running projects that need shared context, not a new session every time.',
    category: 'Guide',
    readMinutes: 10,
    publishedAt: '2026-05-22',
    keywords: [
      'persistent AI memory',
      'AI project workspace',
      'AI knowledge base',
      'long-term AI projects',
      'AI context window',
      'project intelligence',
    ],
  },
  {
    slug: 'research-without-chaos',
    title: 'Research Without Chaos: A Branching Workflow for Deep AI Investigation',
    description:
      'A repeatable system for doing serious research with an AI — how to branch hypotheses, separate sources, compare findings, and never lose the thread of an investigation.',
    category: 'Guide',
    readMinutes: 10,
    publishedAt: '2026-05-22',
    keywords: [
      'AI research workflow',
      'organize AI research',
      'deep research with AI',
      'ChatGPT research',
      'branching research',
      'structured AI exploration',
    ],
  },
  {
    slug: 'ai-for-deep-work',
    title: 'AI for Deep Work: How Branching Conversations Protect Your Focus',
    description:
      'Most AI chat interfaces are built for quick replies, not concentrated thinking. A look at what deep work with an AI looks like — and how a branching canvas keeps you in flow instead of starting over.',
    category: 'Essay',
    readMinutes: 8,
    publishedAt: '2026-05-22',
    keywords: [
      'AI deep work',
      'focus with AI',
      'AI for knowledge workers',
      'deep work tools',
      'focused AI workflow',
      'AI without distractions',
    ],
  },
]

export function getPost(slug: string): PostMeta | undefined {
  return POSTS.find((p) => p.slug === slug)
}
