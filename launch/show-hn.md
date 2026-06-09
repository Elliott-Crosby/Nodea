# Show HN — Nodea AI

Use these for a Show HN submission on Hacker News (news.ycombinator.com/submit). Title in the title field, URL = https://nodea.ai, body pasted into the text field (Show HN posts can have both a URL and text — put the body in the text box).

---

## Title options (pick one)

Show HN titles must start with `Show HN:` and stay honest. Three to choose from (all under 80 chars):

1. `Show HN: Nodea AI – your AI chat as a branching tree, not one long thread`
2. `Show HN: Nodea AI – fork any reply in a Claude chat into its own branch`
3. `Show HN: Nodea AI – a branching canvas for Claude (fork instead of restart)`

Option 1 is the safest: it states the core idea plainly and contains "Nodea AI" for the brand-search disambiguation (the name collides with the Springer "NoDEA" math journal and a Node.js tool, so the bare word "Nodea" is a weak handle).

---

## Body text

> Paste into the text field. ~210 words.

Hi HN — I built Nodea because linear chat fights the way I actually think.

In a normal AI chat, every message stacks onto one thread. The moment you want to try a different angle — a different tone, a different assumption, a "what if we did the opposite" — you either overwrite the good answer or paste it into a new chat and lose the context. Branches collapse into one line. So I made the branch the primitive.

Nodea is a branching AI chat canvas. Every reply becomes a node you can fork from — your conversation grows as a tree of branches, not one long thread. You pan and zoom the tree, fork any node into a new path, and compare branches side by side without destroying the original.

What's built today: the canvas, forking, side-by-side branches, projects to group conversations, and a Chrome extension that imports a Claude.ai chat (including its hidden edit/regenerate branches) as a tree. Models are Anthropic Claude only — Haiku 4.5, Sonnet 4.6, Opus — with automatic routing by complexity.

What's NOT built yet, honestly: bring-your-own-key, plugins, and full export. Those are roadmap, not shipped.

Stack: Next.js 16, React 19, TypeScript, Tailwind v4, Supabase (Postgres + Auth + RLS), Vercel AI SDK, Claude API.

Free during beta, no card. I'd love feedback on whether the tree actually helps you think, or just adds UI.

---

## First comment (post immediately, from your own account)

> Post this as the first comment within a minute of submitting, so the technical detail is there when people arrive.

A few implementation notes and honest limitations, since this crowd will ask:

- **Data model.** A conversation is a tree of message nodes in Postgres (each node stores parent_id, role, content, model). Forking is just creating a child node from any point, so the "tree" is literal, not a UI metaphor. Supabase RLS isolates every user's rows; anonymous sign-in is supported so you can try it without an account.

- **Why Claude-only.** I didn't want to ship a model picker that pretends every model is equivalent. It's Haiku 4.5 / Sonnet 4.6 / Opus, routed automatically by complexity, via the Vercel AI SDK. Multi-provider isn't a goal right now.

- **The Chrome extension.** It reads your *own* open Claude.ai conversation through Claude's own API using your existing login (read-only, no scraping endpoint of mine), reconstructs the hidden branch tree from edits/regenerations, and hands it to your Nodea account on an explicit click. No conversation text touches my servers unless you import. Not affiliated with Anthropic.

- **Known rough edges.** No BYOK yet (you're on my managed keys, ~25k tokens/day free). Export is minimal. Big trees need better minimap/perf work. Mobile is read-friendly but not built for editing yet.

Happy to go deeper on any of it.

---

## Visual assets (if you also post screenshots in comments, or for a follow-up tweet/thread)

HN itself is text-only, but link assets in comments or use them for the cross-post:

- **Hero — "Stop scrolling. Start branching."** Best single image if someone asks "what does it look like?" — links the headline to the core behavior.
- **"Same model. Better thinking." (linear-vs-canvas comparison)** Use this when defending the premise in comments ("why not just open a new chat?"). It shows the one-thread vs. tree contrast directly.
- **Conversation-tree screenshot** + **node-coloring screenshot** — the real product, for "show me the actual UI" replies.
- **Projects screenshot** — when the projects/organization point comes up.
- **"Nodea Tree for Claude" extension tile** + **Claude.ai extension sidecar screenshot** — pair these in any reply about the import flow.
- Skip the two vertical promo cards ("A branching AI chat canvas", "Why settle for one answer?") here — they're ad-shaped and read as marketing on HN.

---

## HN strategy notes

**Timing.** Aim for a US weekday morning — roughly **7–9am US Eastern (Mon–Thu)**. That puts you on the new page as the US wakes up and Europe is still active, giving the longest runway to catch the front page. Avoid Friday afternoon through Sunday (lower traffic, things stall). Don't submit and walk away — be at your desk for the first 2–3 hours to answer comments fast; early engagement is most of the battle.

**Never ask for upvotes.** This is the cardinal rule. No "upvote this," no DMing friends a direct link to vote, no Slack/Discord vote rallies. HN's voting ring detection is aggressive and will silently bury (or flag) a post — and the mods do this by hand too. You can tell people the post exists; you cannot ask them to vote. Let it rise or die on its own.

**Responding to critical comments.**
- Reply to *everyone*, fast, especially skeptics. Founder presence in the thread is what HN rewards.
- Concede real limitations immediately ("yep, no BYOK yet, that's roadmap") — defensiveness reads worse than the flaw itself.
- Treat "why not just open a new chat / use branches in X" as the central question, because it will be the top comment. Answer it with the mechanism (the tree is the data model; forking preserves context instead of copy-pasting), not with adjectives.
- Never argue about downvotes, never edit a comment to snipe back, never accuse people of not reading. Thank harsh-but-fair critics by name.
- If someone finds a bug, fix it or file it publicly in the thread — "shipping in front of you" plays extremely well.

**New-account gating.** Brand-new HN accounts are often rate-limited or can't submit links right away (and `show` posts from green-username accounts get less benefit of the doubt). Mitigations:
- **Age the account first.** For a week or two before launch, leave genuine, substantive comments on other threads. Karma + age both help your submission go through and look credible.
- If your account still can't submit, **email hn@ycombinator.com**, briefly explain it's a genuine Show HN of your own project, and ask them to enable submission / consider it for a second-chance pool. They're responsive and reasonable.
- Post the **first comment from the same account** that submitted (see above) so the thread opens with substance, not silence.

**One more lever.** If the first attempt underperforms (the earlier Product Hunt run got 2 upvotes), you can email hn@ycombinator.com and ask them to put a genuine, well-received-but-buried Show HN into the **second-chance queue** — they re-surface solid posts that got unlucky on timing. Ask once, politely, and only if the post genuinely had merit.
