# Nodea — Open Source Low-Code Platform for Node.js

> Generate production-ready Node.js web applications by giving instructions to an AI bot. No boilerplate. No scaffolding scripts. Just describe what you want and ship.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-database%20%26%20auth-green?logo=supabase)](https://supabase.com)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-nodea--software.com-orange)](https://nodea-software.com)

---

## What is Nodea?

Nodea is an open-source, computer-aided development platform that generates full **Node.js web applications** from natural language instructions. Tell the bot what you need — entities, modules, UI, logic — and Nodea scaffolds a complete, production-ready application with no proprietary lock-in.

It has been used to deliver over 40 major applications across enterprise, education, and digital services teams.

**This repository is the Nodea admin dashboard** — the operator interface for managing your Nodea platform, viewing analytics, and running the AI-powered blog studio.

---

## Features

- **AI-Powered Code Generation** — describe your application in plain language, get runnable Node.js code
- **Low-Code Studio** — visual interface for defining entities, modules, and application logic
- **Analytics Dashboard** — monitor platform usage, application health, and team activity
- **AI Blog Studio** — keyword research and automated article generation powered by Claude AI
- **Authentication** — role-based access control via Supabase
- **Subscription Management** — Stripe-backed billing and plan management
- **Open Source** — MIT licensed, no proprietary components in generated applications

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database & Auth | Supabase |
| AI | Anthropic Claude API (via Vercel AI SDK v6) |
| Payments | Stripe |
| Flow / Diagrams | XYFlow (React Flow) |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js v18 or later
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)
- A [Stripe](https://stripe.com) account

### Install

```bash
git clone https://github.com/Elliott-Crosby/Nodea_1.git
cd Nodea_1
npm install
```

### Environment Variables

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

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
nodea/
├── public/                     # Static assets
├── src/
│   └── app/                    # Next.js App Router — pages, layouts, API routes
│       ├── _components/        # Shared UI components (landing page sections, page tracker)
│       ├── admin/              # Admin dashboard — analytics, traffic, and usage charts
│       ├── api/
│       │   ├── admin/
│       │   │   ├── analytics/  # Analytics data endpoints
│       │   │   └── traffic/    # Traffic tracking read/write endpoints
│       │   ├── autotitle/      # AI-powered conversation title generation
│       │   ├── chat/           # Main Claude AI chat streaming endpoint
│       │   ├── debug-usage/    # Token and usage debug endpoint
│       │   ├── projects/       # Project CRUD endpoints
│       │   ├── search/         # Search endpoint
│       │   ├── stripe/
│       │   │   ├── checkout/   # Stripe checkout session creation
│       │   │   ├── portal/     # Stripe billing portal redirect
│       │   │   └── webhook/    # Stripe webhook handler
│       │   ├── track/          # Page view tracking
│       │   ├── track-duration/ # Session duration tracking
│       │   └── track-event/    # Custom event tracking
│       ├── app/                # Main app — chat interface, sidebar, settings modal
│       ├── login/              # Login page and password reset flow
│       └── upgrade/            # Pricing and subscription upgrade page
├── supabase/
│   └── migrations/             # Database schema migrations
├── AGENTS.md                   # AI agent instructions
├── CLAUDE.md                   # Claude Code project config
└── package.json
```

---

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm start        # Run production build
npm run lint     # Run ESLint
```

---

## Deployment

Deploy to [Vercel](https://vercel.com) — connect this repository, add your environment variables in the Vercel project settings, and deploy.

Live at: [https://nodea-software.com](https://nodea-software.com)

---

## About Nodea Software

- 🌐 [nodea-software.com](https://nodea-software.com)
- 📖 [docs.nodea-software.com](https://docs.nodea-software.com)
- 💬 [GitHub Discussions](https://github.com/nodea-software/Nodea/discussions)
- 🏢 [Core platform repo](https://github.com/nodea-software/Nodea)

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
