# Reddit Community Pack — Nodea AI

Subreddit-specific posts for a stronger launch push after the soft Product Hunt run. Each post is written for the rules and culture of its target sub, with the right media image and a posting cadence that won't read as a spam blast.

**Always disclose you're the maker.** It's a rule on most of these subs and a trust-killer everywhere else. Every post below already does this.

**One-line positioning (use verbatim when you state what Nodea is):**
> Nodea is a branching AI chat canvas. Every reply becomes a node you can fork from — your conversation grows as a tree of branches, not one long thread.

Product is **Nodea AI** (nodea.ai). Disambiguate from the "NoDEA" math journal and the Node.js tool — always say "Nodea AI" or link nodea.ai, never bare "Nodea" in a title.

---

## Promotion rules per subreddit (read this first)

| Subreddit | Direct promotion? | Framing you must use | Maker disclosure |
|---|---|---|---|
| **r/SideProject** | ✅ Yes — it's the whole point of the sub | "I built X, here's how/why" | Required |
| **r/ClaudeAI** | ⚠️ Tolerated if useful | Lead with a Claude workflow problem; tool is the answer, not the headline | Required |
| **r/artificial** | ⚠️ Light — discussion-first sub | Lead with an idea/observation about how we use chat UIs; tool as a footnote | Required |
| **r/ChatGPT** | ❌ Hostile to plugs | Pure value/story post; mention the tool once, low in the body, only if asked | Required if mentioned |
| **r/LocalLLaMA** | ❌ Self-promo gets removed | Honest "this is hosted, not local — here's the one idea that might still interest you" | Required, up front |

**Golden rule:** the stricter the sub, the higher the value-to-plug ratio. On r/ChatGPT and r/LocalLLaMA you are basically giving away an idea and letting people find you in the comments.

---

## Posting cadence (do NOT post all five the same day)

Cross-posting the same launch to five subs within an hour is the fastest way to get auto-flagged and shadow-removed. Space it out, and adapt each post to what landed.

- **Day 1 (Tue or Wed, ~9–11am ET):** r/SideProject. Friendliest audience, good signal on whether the hook lands.
- **Day 2:** r/ClaudeAI. Most qualified audience — they already live in Claude. Fold in any sharp comment you got on Day 1.
- **Day 4:** r/artificial. Discussion angle; lower promo.
- **Day 6–7:** r/ChatGPT. Highest-traffic, lowest-tolerance — go last, fully value-first, only after the copy is battle-tested.
- **Day 8+:** r/LocalLLaMA. Niche, skeptical, off-thesis (you're hosted). Only worth it as an honest idea post; skip if you're short on bandwidth.

Reply to every comment within the first 2 hours — engagement window is short and the algorithm rewards it. Never argue with skeptics; thank them and answer the actual question.

---

## r/SideProject

**Image:** vertical promo card **"A branching AI chat canvas"** (clean, self-explanatory; this sub scrolls fast and wants to grok the product in one frame).

**Title:**
`I built a branching AI chat canvas — fork any Claude reply into a new node instead of one endless thread`

**Body:**
```
Maker here. I kept hitting the same wall in every AI chat: I'd be three good answers deep, want to try a different direction, and the only options were to scroll back and lose my place or start a whole new chat and lose the context.

So I built Nodea AI (nodea.ai). It's a branching AI chat canvas. Every reply becomes a node you can fork from — your conversation grows as a tree of branches, not one long thread. You can fork any reply into a new node, pan/zoom around the tree, compare two branches side-by-side, and keep every path you've explored.

A few honest details:
- It runs on Anthropic's Claude only (Haiku 4.5, Sonnet 4.6, Opus 4.7), with automatic model routing by complexity so simple turns don't burn a big model.
- Conversations live in Supabase with per-user isolation; you can group them into projects.
- There's a Chrome extension ("Nodea Tree for Claude") that imports your existing claude.ai chats as a branching tree.
- Free during beta — no credit card. Free tier is ~25k tokens/day. Pro is $8/mo when billing turns on.

Stuff that's NOT built yet, so I'm not going to pretend it is: bring-your-own-API-keys, plugins, full export tooling, and a project-wide "connected canvas". Those are roadmap.

I did a quiet Product Hunt launch that underperformed, so I'm trying to learn in public this time. What's the first thing you'd want to do with a tree-shaped chat — and what would make you bounce? Genuinely want the harsh version.
```
*Why this works on r/SideProject:* explicit maker disclosure, real build details, an honest roadmap caveat, and a question that invites feedback rather than upvotes.

---

## r/ClaudeAI

**Image:** product screenshot of the **conversation tree with node coloring** (this audience wants to see the actual Claude branching, not a marketing card). Alternative: the **"Nodea Tree for Claude" extension tile** if you lead with the import angle.

**Title:**
`I got tired of losing context when I explored tangents in Claude, so I built a branching canvas for it`

**Body:**
```
Disclosure up front: I made this, so flag it as self-promo if that's not allowed — but I think the workflow is the interesting part.

If you use Claude for anything exploratory — comparing approaches, debugging down two different theories, drafting variations — you've probably felt this: one long thread can only hold one path. Editing a message regenerates and buries the version you liked. Starting a new chat drops all your context.

Claude actually stores conversations as a tree internally (every edit/regenerate is a sibling branch). Most UIs just flatten it. So I built Nodea AI (nodea.ai) around that tree instead of hiding it. Every reply becomes a node you can fork from — your conversation grows as a tree of branches, not one long thread. Fork any reply, pan/zoom the tree, color-code nodes, and compare two branches side-by-side without losing either.

For people already deep in claude.ai: there's a "Nodea Tree for Claude" Chrome extension that reads your existing conversation's branch tree (via your own login, read-only) and can import the whole thing into Nodea as a visual tree.

Models are Claude only — Haiku 4.5, Sonnet 4.6, Opus 4.7 — with automatic routing by complexity. Free during beta, no card.

Not affiliated with Anthropic. Honest about what's not done yet: BYOK, plugins, and full export are still on the roadmap. If you regularly branch your Claude chats, I'd love to know whether the visual tree actually matches your mental model or not.
```
*Why this works on r/ClaudeAI:* leads with a real Claude-specific pain (the hidden internal tree), positions the tool as the fix, discloses maker + non-affiliation, and asks a Claude-power-user question.

---

## r/artificial

**Image:** the **"Same model. Better thinking." linear-vs-canvas comparison** (this sub rewards an idea, and that image *is* the idea in one picture).

**Title:**
`The chat UI quietly decides how we think with AI — we've defaulted to one linear thread for everything`

**Body:**
```
Something I keep coming back to: the interface for AI chat is almost universally a single scrolling thread, and I think that quietly constrains how we reason with these models. A thread is great for a linear Q&A. It's bad for the thing people actually do — exploring, comparing, backtracking, holding two hypotheses at once. The moment you branch, a thread forces you to either overwrite the good path or abandon your context in a new chat.

Same model, different interface, genuinely different thinking. If you can fork a reply and keep both directions alive side-by-side, you stop treating the conversation as disposable and start treating it as a map you're building.

Full disclosure, this is also what I'm building (Nodea AI — a branching AI chat canvas on Claude), so take it with the appropriate salt. But I'm more interested in the general question here than the plug: do you think the linear-thread default is actually limiting how people use LLMs, or is it fine and I'm overthinking a UI preference? Curious where this sub lands.
```
*Why this works on r/artificial:* it's a discussion post first. The product is a one-line disclosure midway through, and the post ends on an open question, not a CTA.

---

## r/ChatGPT

**Image:** the **hero "Stop scrolling. Start branching."** image — it's a meme-able, instantly legible idea that fits this sub's high-scroll feed. (Use it only if you mention the tool; otherwise post text-only.)

**Title:**
`PSA: your AI chat is secretly a tree — every time you edit or regenerate, you're creating a branch you can't see`

**Body:**
```
Mostly a "huh, neat" post. A lot of people don't realize that when you edit a prompt or hit regenerate, the chat doesn't overwrite the old version — it forks. The model keeps both as sibling branches under the hood; the interface just shows you one and hides the rest. So your "linear" chat is really a tree that's been flattened down to a single visible path.

Once you see it that way, a bunch of habits make more sense: starting a new chat to "keep the old one clean," screenshotting an answer before you regenerate, copy-pasting a reply somewhere safe before you try a different direction. Those are all workarounds for not being able to see or move around the branch tree.

I'll be upfront since the rules are the rules: I build a tool in this space, so I'm not going to name-drop it in the body — happy to share in the comments if anyone actually wants it. But even without any tool, just knowing your chats are trees changes how you use edit/regenerate. Try treating a regenerate as "open a new branch" instead of "replace my answer" and see if you hoard fewer dead chats.
```
*Why this works on r/ChatGPT:* it's a genuinely useful TIL with zero plug in the body. The disclosure is honest, the product name is withheld until someone asks — which keeps it on the right side of the no-spam culture and usually gets people to ask.

---

## r/LocalLLaMA

**Image:** the second vertical promo card **"Why settle for one answer?"** — but honestly, on this sub the post text carries it; attach the image only if a screenshot adds info. Prefer the **conversation-tree screenshot** if you attach anything, since this crowd wants to see the actual UI, not a slogan.

**Title:**
`Branching/tree-shaped chat as a UI pattern — worth it even though my implementation is hosted, not local`

**Body:**
```
Disclosure first, because this sub (rightly) hates stealth plugs: I built a hosted branching chat tool, it runs on Claude, and it is NOT local. I'm not here to convince anyone to use a closed API. I'm here for the UI idea, which I think is underexplored in local tooling.

The idea: instead of one linear thread, treat the conversation as a tree. Every reply is a node you can fork from. You pan/zoom a canvas, branch any message into a new direction, compare branches side-by-side, and never lose a path. Editing/regenerating becomes "open a sibling branch" instead of "destroy the previous answer." It maps cleanly onto how a lot of us already script multiple generations and diff them.

Why I think it's relevant here even though mine is hosted: nothing about the tree pattern requires a closed model. The branch tree is just conversation state — node id, parent id, role, text. Any local backend (llama.cpp, Ollama, text-gen-webui) could expose the same shape, and a canvas frontend could sit on top. If you're building local UIs, the regenerate-as-branch + side-by-side-compare combo is a genuinely nice UX win and it's all client-side state.

If you want to see a working reference of the pattern, mine is Nodea AI (nodea.ai) — Claude-backed, so caveat emptor on the "local" front. Mostly I'm curious whether anyone's already done a clean tree/branch UI on top of a local stack, because I'd use it.
```
*Why this works on r/LocalLLaMA:* it opens by admitting the off-thesis problem (it's hosted), reframes around a portable UI pattern the local crowd can actually use, and only names the product near the very end as a "reference implementation." That's the only register this sub tolerates from someone with a commercial tool.

---

## Comment-ready replies for "how is this different from X?"

Drop these in when someone asks. Keep them short, concrete, and non-defensive.

**Reply A — "How is this different from ChatGPT / regular Claude chat?"**
```
Fair question. Regular chat (ChatGPT or claude.ai) is one linear thread — you can only see one path at a time, and editing or regenerating buries the version you liked. Nodea makes that hidden tree the main view: every reply is a node you can fork from, you can keep multiple branches alive at once, compare two side-by-side, and pan/zoom the whole tree. Same Claude models underneath — the difference is the canvas, not the model. (Maker here, fwiw.)
```

**Reply B — "How is this different from Claude Projects / folders?"**
```
Different layer. Claude Projects group your chats and share context across them, but each chat inside is still a single linear thread. Nodea is about the structure *within* a conversation — forking any reply into a branch, exploring alternatives without losing the original, and seeing it all as one tree on a canvas. We do have a "projects" concept too for grouping, but the core thing Projects doesn't give you is branching inside a conversation. (I build Nodea, so grain of salt.)
```
