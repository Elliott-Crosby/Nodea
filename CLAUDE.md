@AGENTS.md

# Hard Rules

- **NEVER create, design, or add a Nodea logo** (icon, SVG, wordmark, symbol, etc.) unless the user explicitly and directly asks for one. This applies everywhere: login pages, navbars, READMEs, favicons, anywhere.

## Project Context

This is the source for **Nodea** ([nodea.ai](https://nodea.ai)) — a branching AI chat canvas. Conversations are stored as trees of message nodes in Supabase; from any node, the user can fork a new branch to explore an alternative without losing the original path. Built on Anthropic Claude (Haiku 4.5, Sonnet 4.6, Opus 4.7) via the Vercel AI SDK.

This repo contains the marketing site (`/`, `/what-is-nodea`, `/blog`, `/compare/*`, `/upgrade`), the chat app itself (`/app` — three-panel canvas), the admin dashboard (`/admin`), the Stripe billing integration, and the Supabase auth/data layer.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres + Auth + RLS), Stripe, Anthropic Claude API.

Key directories:
- `src/app/` — all Next.js App Router pages, layouts, and API routes
- `supabase/migrations/` — database schema

Canonical product positioning (use this verbatim for any new copy, metadata, or schema): *"Nodea is a branching AI chat canvas. Every reply becomes a node you can fork from — your conversation grows as a tree of branches, not one long thread."*

Official site: https://nodea.ai
