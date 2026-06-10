# Nodea Extension — 15s Demo Video · Design Brief

**For:** Claude Design (has direct repo access)
**Deliverable:** Animated HTML/CSS prototype, 1280×720, 16:9, screen-recordable into the final video.
**Working prototype already built:** [`mockups/extension-demo.html`](./extension-demo.html) — open in a browser, it loops. This brief is the spec behind it; refine or rebuild from here.

---

## The one idea to sell

> **Your Claude chat becomes a branching canvas in one click.**

Show real work happening in Claude, then move to Nodea with *absolute ease* — a clean, zoom-and-movement-driven handoff that lands inside a practical, populated Nodea tree.

Corners can be rounded, but it must read as **actual Claude** and **actual Nodea**. Pull real tokens/components from the codebase.

---

## Beat sheet (15s, single continuous camera)

| Time | Screen | Action | Caption |
|------|--------|--------|---------|
| 0–4.2s | **Claude** (claude.ai look) | Finished chat sits there. Cursor drifts toward the docked Nodea extension panel. | *"A great Claude chat."* |
| 4.2–5s | Claude | **Open in Nodea** button presses + glows; camera **zooms** toward the panel. | *"One click — Open in Nodea."* |
| ~5s | Handoff | **Purple wipe** sweeps across with the Nodea wordmark. | — |
| 5–9s | **Nodea** (3-panel app) | Lands in the real canvas; trunk nodes **pop in A→B→C**, edges draw, camera settles over the tree. Sidebar shows the conv with the **Claude provenance badge**. | *"Your whole conversation, as a branching tree."* |
| 9–12s | Nodea | Cursor → a node; **"Fork a branch"** tip appears; a new branch **draws out** at an angle with a streaming reply; camera **pulls back** to reveal both paths. | *"Fork from any reply. Branch, don't restart."* |
| 12–15s | Nodea | Settle, then **Nodea / nodea.ai** CTA fades in. | — |

**Pacing rule:** 0–5s setup, **~5s = the reveal (the hero moment)**, 9–12s = the "aha" (branching), 12–15s = land + CTA.

---

## Exact tokens (from `src/app/globals.css`)

### Nodea (light theme)
| Token | Value |
|-------|-------|
| `--accent` | `#7c3aed` |
| `--accent-hover` | `#6d28d9` |
| `--accent-bg` | `#f0ebff` |
| `--accent-text` | `#6d28d9` |
| `--user-bubble-bg` | `#ede9fe` |
| `--bg-base` / `--topbar-bg` | `#f8f9fa` |
| `--ai-card-bg` | `#ffffff` |
| `--border` | `#d8dade` |
| `--border-strong` | `#b8bcc4` |
| `--text-primary` | `#1a1d23` |
| grid dot (canvas) | `~#d4d7dd`, radial dots `1.3px`, `22px` spacing |

### Claude (depicted UI — fine to use "Claude" wordmark/text; do NOT invent a Nodea logo)
| Element | Value |
|---------|-------|
| Clay accent | `#D97757` |
| Paper bg | `#faf9f5` |
| Border | `#ece9e1` |
| Text | `#26241f` |

### Wordmark standard (Nodea)
Bricolage Grotesque, weight **500–600**, letter-spacing **`-0.025em`**, color `var(--accent)`. Used for nav/extension header/CTA. **No logo/icon/symbol — wordmark text only.**

---

## Component anatomy to match (real code)

### Claude side
- Left sidebar (recents), centered thread (user + Claude reply), clay `✶` avatar, model pill ("Claude Sonnet 4.6").
- **Extension panel** docked top-right: header with `Nodea` wordmark + `TREE` tag, caption *"This conversation, as a branching tree."*, a mini-tree preview, and the primary **Open in Nodea** button (`--accent`, white text, arrow icon).

### Nodea side (3-panel — `src/app/app/`)
- **Sidebar** (`Sidebar.tsx`): conversation row with the **Claude sunburst provenance badge** (`SourceBadge` / clay `#D97757`, 13–14px) between the chat icon and the title — only on `source === 'claude'` convs.
- **ChatPanel** (`ChatPanel.tsx`): 52px top bar with breadcrumb `Conversations › <name>`, the **Update** pill (only on imported convs), 17px sub-header, the ✨ **imported-from-Claude upsell banner** (`color-mix(--accent 8%, --bg-base)`), gradient circular Claude avatar `linear-gradient(135deg, var(--accent), #06b6d4)`, AI bubble `border-radius: 4px 14px 14px 14px`, user bubble `14px 14px 4px 14px` on `--user-bubble-bg`.
- **TreePanel** (`TreePanel.tsx`): dotted-grid canvas; node cards **240×86** (detailed), `border-radius: 10`, `1.5px solid` border (`--node-border`; active = `--accent` with `box-shadow: 0 0 0 3px var(--accent-bg)` and `--node-active-bg`). Card body = generated **title** (11.5px/600) + **summary** (10.5px/`--text-secondary`). Edges are SVG lines/curves — **`--accent` on the active path**, `--edge-color` otherwise. (Prototype uses 208×78 to fit the frame; bump to 240×86 if matching 1:1 and letting the camera crop.)

---

## Animation timeline (how the prototype is wired)

Single **15s** master timeline, `infinite` loop. Every animated element shares `animation-duration: 15s` so it stays in lock-step; behavior is encoded as **percentage keyframes** (`% × 15s`). Reference offsets:

| Beat | % | Time |
|------|----|------|
| Claude idle → cursor to button | 0–27% | 0–4.05s |
| Button press + glow | 27–30% | 4.05–4.5s |
| Purple wipe (Claude→Nodea) | 30–38% | 4.5–5.7s |
| Trunk nodes pop A / B / C | 44% / 50% / 56% | 6.6 / 7.5 / 8.4s |
| Camera settles over trunk | 58% | 8.7s |
| Fork tip + branch edge draws | 72–80% | 10.8–12s |
| Camera pulls back, branch node D streams | 80% | 12s |
| End CTA fades in | 94% | 14.1s |

- **Camera:** per-scene `transform: scale()+translate()` rig. Claude zooms toward the panel (→1.5); Nodea starts ~1.18 zoomed, settles to 1.06, pulls back to 1.0 to reveal the fork.
- **Node pop:** `cubic-bezier(.34,1.56,.64,1)` overshoot, scale `.6→1` + slight rise.
- **Edges:** `stroke-dasharray` draw-on.
- **Handoff:** full-bleed purple gradient `translateX(-101% → 0 → 101%)` with the wordmark flashing at center.

---

## Captions
1. `A great Claude chat.`
2. `One click — **Open in Nodea.**`
3. `Your whole conversation, **as a branching tree.**`
4. `**Fork from any reply.** Branch, don't restart.`
- End CTA: **`Nodea`** wordmark + `nodea.ai — branch, don't restart.`
- Lower-third style: white text, `rgba(15,14,22,.66)` blurred pill, bold spans in `#c4b1f7`.

---

## Example content (swappable)
Current thread = a SaaS **3-email onboarding sequence**. Trunk: prompt → Claude's 3-step structure → "formal tone, full copy" (original path). Fork = **"playful tone variant"** branching off the structure node. Easy to swap for any domain.

---

## Open polish items (next pass)
- Match node cards to true 240×86 (vs 208×78) if you prefer 1:1 fidelity + camera crop.
- Add a cursor-click ripple on the **Open in Nodea** press.
- Confirm the live render visually (preview screenshots were timing out in the build session; layout + all 7 timeline beats were verified via computed styles).
- Optional: real micro-typing on the streaming branch reply instead of bouncing dots.

---

## Hard rules (must honor)
- **Never invent a Nodea logo/icon/symbol** — wordmark text only.
- Nodea positioning, verbatim where copy is needed: *"Nodea is a branching AI chat canvas. Every reply becomes a node you can fork from — your conversation grows as a tree of branches, not one long thread."*
