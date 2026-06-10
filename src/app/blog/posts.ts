export interface PostMeta {
  slug: string
  title: string
  description: string
  category: 'Pillar' | 'Essay' | 'Field note' | 'Guide'
  readMinutes: number
  publishedAt: string
  updatedAt?: string
  keywords: string[]
  /** Hero/card media for the post — lives in /public/media. */
  image: string
  imageAlt: string
}

export const POSTS: PostMeta[] = [
  {
    slug: 'branching-ai-chat-guide',
    title: 'Branching AI Chat: A Guide to Non-Linear Claude Chat',
    description:
      'What branching AI chat is, why linear chatbots fail at exploration, how to fork ChatGPT and Claude conversations, and the tools that make it possible.',
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
    image: '/media/nodea-ai-linear-vs-branching-canvas.png',
    imageAlt:
      'A linear chat where an earlier answer is buried in scroll, beside a Nodea canvas where every path stays visible as branches.',
  },
  {
    slug: 'fork-chatgpt-conversation',
    title: 'How to Fork a ChatGPT Conversation (Workarounds Break)',
    description:
      'The three ways to branch a ChatGPT or Claude conversation — the edit trick, the regenerate trick, and duplicate tabs — plus exactly where each one fails.',
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
    image: '/media/nodea-ai-extension-claude-reveal.png',
    imageAlt:
      'A Claude.ai conversation rebuilt as a forkable Nodea tree of nodes with an Open in Nodea button.',
  },
  {
    slug: 'tree-of-thought-prompting',
    title: 'Tree of Thought Prompting: What It Is and How to Use It',
    description:
      'A practical guide to Tree of Thought prompting: how it differs from chain-of-thought, when it beats step-by-step reasoning, and why your interface matters.',
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
    image: '/media/nodea-ai-screenshot-conversation-tree.png',
    imageAlt:
      'The Nodea app showing a conversation in the centre and its full branching tree in the right-hand panel.',
  },
  {
    slug: 'compare-ai-model-outputs',
    title: 'How to Compare AI Model Outputs Side by Side',
    description:
      'How to run honest A/B comparisons between Claude, ChatGPT, and other models — prompt design, what to actually measure, and tools that make it tractable.',
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
    image: '/media/nodea-ai-screenshot-colored-branches.png',
    imageAlt:
      'A Nodea canvas with several colour-coded branches fanning out from one question, each exploring a different option.',
  },
  {
    slug: 'never-lose-thinking',
    title: 'Never Lose a Train of Thought in a Linear AI Chat Again',
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
    image: '/media/nodea-ai-live-demo-conversation-tree.png',
    imageAlt:
      'A Nodea tree of message nodes branching from a brand-positioning prompt, with every direction preserved as its own node.',
  },
  {
    slug: 'organize-ai-like-your-brain',
    title: 'Organize AI Conversations the Way Your Brain Actually Works',
    description:
      'Human thinking branches; chat forces it into one line. Why tree-shaped AI conversations match how ideas actually develop — and how to use them.',
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
    image: '/media/nodea-ai-wordmark-think-in-branches.png',
    imageAlt:
      'The Nodea wordmark with the tagline Think in branches on a dotted canvas with branch lines.',
  },
  {
    slug: 'persistent-project-intelligence',
    title: 'Persistent Project Intelligence: AI Chats as Knowledge',
    description:
      'Make AI conversations accumulate value over weeks instead of dying with the tab — a workflow for long-running projects that need shared context.',
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
    image: '/media/nodea-ai-screenshot-projects.png',
    imageAlt:
      'The Nodea Projects view showing a project with multiple conversations, each previewed as the shape of its branching tree.',
  },
  {
    slug: 'research-without-chaos',
    title: 'Research Without Chaos: A Branching AI Research Workflow',
    description:
      'A repeatable system for serious AI research: branch hypotheses, separate sources, compare findings, and never lose the thread of an investigation.',
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
    image: '/media/nodea-ai-screenshot-marketing-canvas.png',
    imageAlt:
      'A Nodea research canvas with a long analysis on the left and a branching tree of follow-up threads on the right.',
  },
  {
    slug: 'ai-for-deep-work',
    title: 'AI for Deep Work: How Branching Conversations Protect Focus',
    description:
      'Most AI chat is built for quick replies, not concentrated thinking. What deep work with an AI looks like — and how a branching canvas keeps you in flow.',
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
    image: '/media/nodea-ai-branching-chat-canvas.png',
    imageAlt:
      "Nodea's branching chat canvas with the tagline Stop scrolling. Start branching., showing a launch-plan conversation and its tree.",
  },
]

export function getPost(slug: string): PostMeta | undefined {
  return POSTS.find((p) => p.slug === slug)
}
