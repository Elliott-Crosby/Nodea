# Nodea — Branching AI Chat Canvas

> Nodea is a branching AI chat canvas. Every reply becomes a node you can fork from — your conversation grows as a tree of branches, not one long thread that you keep scrolling. Built on Anthropic Claude. Free during beta.

**Live product:** [https://nodea.ai](https://nodea.ai) — open a canvas, no credit card, no waitlist.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-database%20%26%20auth-green?logo=supabase)](https://supabase.com)
[![Live](https://img.shields.io/badge/Live-nodea.ai-orange)](https://nodea.ai)

---

## What is Nodea?

Nodea is a non-linear interface for chatting with Anthropic's Claude models. Instead of one linear thread per conversation, every message you and the AI exchange is stored as a node in a tree. **From any node, you can branch** — ask the same question a different way, explore an alternative plan, compare two phrasings — without overwriting or losing the original path.

The product is for people who think by exploring alternatives: writers, researchers, founders, engineers, anyone who notices that "regenerate" and "start new chat" both destroy useful context.

### How it differs from ChatGPT, Claude.ai, Poe

| | Linear chat (ChatGPT, Claude.ai) | Nodea |
|---|---|---|
| Conversation shape | A list | A tree |
| Try a different answer | Edit message (destroys history) or new chat (loses context) | Branch from any node, original stays put |
| See all explored paths | No | Yes — visible on the canvas |
| Compare two answers | Two tabs, manually | Side-by-side, same canvas |
| Search across branches | One thread at a time | Across every path |

Long-form explainer with architecture and design notes: **[nodea.ai/what-is-nodea](https://nodea.ai/what-is-nodea)**.

---

## This repository

This repo is the source for the hosted Nodea product at [nodea.ai](https://nodea.ai). It contains:

- The marketing site (`/`, `/what-is-nodea`, `/blog`, `/compare/*`, `/upgrade`)
- The chat app itself (`/app` — three-panel canvas with sidebar, chat, and tree)
- The admin dashboard (`/admin` — usage analytics, traffic, model routing)
- The Stripe billing integration, Supabase auth, and Claude streaming endpoints

It's MIT-licensed — fork it, self-host it, or read it to understand the architecture.

---

## Features

- **Branching from any reply** — the data model is a tree of nodes; the UI is a view onto that tree
- **Tree canvas** — XYFlow surface with free pan/zoom over the whole conversation graph
- **Model routing** — auto-selects Claude Haiku 4.5, Sonnet 4.6, or Opus 4.7 by prompt complexity and plan tier
- **Streaming responses** — token-by-token via the Vercel AI SDK
- **Search** — live keyword search plus semantic ("concept") search via Claude
- **Anonymous mode** — start a canvas without signing up; claim it later by linking an email
- **Color-coded nodes** — tag the keepers, skim a project at a glance
- **Stripe billing** — $0 free (25k daily / 450k monthly tokens), $8/mo Pro for Claude Opus + 50k daily / 1M monthly tokens

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router), React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + CSS variable theming |
| Database + auth | Supabase (Postgres with RLS, Supabase Auth) |
| AI streaming | Vercel AI SDK v6 (`ai` + `@ai-sdk/anthropic`) |
| Models | Anthropic Claude — Haiku 4.5, Sonnet 4.6, Opus 4.7 |
| Canvas | XYFlow (React Flow) |
| Billing | Stripe Checkout + Customer Portal |
| Deployment | Vercel |

---

## Getting started

### Prerequisites

- Node.js v18 or later
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)
- A [Stripe](https://stripe.com) account (only required for Pro plan billing)

### Install

```bash
git clone https://github.com/Elliott-Crosby/Nodea.git
cd Nodea
npm install
```

### Environment variables

Create a `.env.local` file in the project root. **Never commit this file.**

```env
# Supabase — Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Anthropic — console.anthropic.com > API Keys
ANTHROPIC_API_KEY=

# Stripe — Dashboard > Developers > API Keys
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
nodea/
├── public/                     # Static assets
├── src/
│   └── app/                    # Next.js App Router — pages, layouts, API routes
│       ├── _components/        # Shared UI (landing sections, page tracker)
│       ├── admin/              # Admin dashboard — analytics, traffic, usage
│       ├── api/
│       │   ├── admin/          # Analytics + traffic endpoints
│       │   ├── autotitle/      # AI-powered conversation title generation
│       │   ├── chat/           # Main Claude streaming endpoint
│       │   ├── projects/       # Project (conversation) CRUD
│       │   ├── search/         # Keyword + concept search
│       │   ├── stripe/         # Checkout, portal, webhook
│       │   └── track*/         # Page-view + event tracking
│       ├── app/                # Main canvas — chat + tree + sidebar
│       ├── blog/               # /blog index + posts
│       ├── compare/            # /compare/* head-to-head pages
│       ├── login/              # Login + password reset
│       ├── upgrade/            # Pricing page
│       └── what-is-nodea/      # Long-form explainer
├── supabase/migrations/        # Database schema migrations
├── AGENTS.md                   # AI agent instructions
├── CLAUDE.md                   # Claude Code project config
└── package.json
```

### Data model (Supabase)

Two tables — that's the whole branching engine.

```
projects (id, user_id, name, created_at)

nodes    (id, project_id, parent_id, role, content,
          position_x, position_y, created_at)
```

A conversation is a `project`. Every message is a `node` with a single `parent_id`. Branching is just inserting a new node whose `parent_id` points to some existing node. The chat panel for a selected node is the chain you get by walking `parent_id` back to null. Row-level security (`auth.uid() = user_id`) isolates users.

---

## Available scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm start        # Run production build
npm run lint     # Run ESLint
```

---

## Deployment

Deploy to [Vercel](https://vercel.com) — connect this repository, add the environment variables above in the Vercel project settings, and deploy. The production deploy serves [nodea.ai](https://nodea.ai).

---

## Links

- 🌐 Product: [nodea.ai](https://nodea.ai)
- 📖 What is Nodea?: [nodea.ai/what-is-nodea](https://nodea.ai/what-is-nodea)
- 📝 Blog: [nodea.ai/blog](https://nodea.ai/blog)
- 💬 Discussions: [github.com/Elliott-Crosby/Nodea/discussions](https://github.com/Elliott-Crosby/Nodea/discussions)
- 🏢 Source: [github.com/Elliott-Crosby/Nodea](https://github.com/Elliott-Crosby/Nodea)

---

## Contributing

1. Fork this repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

[MIT](LICENSE)
