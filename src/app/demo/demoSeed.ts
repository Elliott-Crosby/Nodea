// ─── Pre-seeded demo conversation ────────────────────────────────────────────
// A visitor to /demo lands on a canvas that's already been "used for a while": a
// coffee-shop planning session that branched in many directions — naming styles
// (playful / plant-themed / upscale), then, off the chosen name, four parallel
// workstreams (interior, menu, brand voice, launch plan). The topic is neutral
// and legible so the *branching* does the explaining, not the content.
//
// Timestamps are hardcoded (not Date-derived) so server and client render the
// exact same tree — no hydration mismatch — and so siblings sort left→right in
// node order. Live nodes the visitor adds get real timestamps at interaction
// time (client-only), so they always sort after the seed.

export interface DemoNode {
  id: string
  parent_id: string | null
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface NodeMeta {
  title: string
  summary: string
}

// Anchor a sticky note to a pair (the assistant node's id), offset in canvas px.
export interface StickySeed {
  id: string
  anchorPairId: string
  dx: number
  dy: number
  w: number
  h: number
  text: string
}

// created_at helper: strictly ascending by node order (16:00, 16:01, …).
const t = (n: number) => `2026-05-01T16:${String(n).padStart(2, '0')}:00.000Z`

export const SEED_NODES: DemoNode[] = [
  // ── Root + the main naming fork ──
  { id: 'n1', parent_id: null, role: 'user',      content: "Help me name my coffee shop — it's cozy, plant-filled, with tons of natural light.", created_at: t(1) },
  { id: 'n2', parent_id: 'n1', role: 'assistant', content: 'Three to start:\n\n- **Fern & Filter**\n- **Sunroom Coffee**\n- **The Daylight Room**\n\nPlayful, upscale, or plant-themed?', created_at: t(2) },

  // ── Playful names ──
  { id: 'n3', parent_id: 'n2', role: 'user',      content: 'Go more playful.', created_at: t(3) },
  { id: 'n4', parent_id: 'n3', role: 'assistant', content: 'Playful:\n\n- **Bean There**\n- **Leaf It to Me**\n- **Brew-ti-ful Day**', created_at: t(4) },
  { id: 'n5', parent_id: 'n4', role: 'user',      content: 'Love "Leaf It to Me." Tagline?', created_at: t(5) },
  { id: 'n6', parent_id: 'n5', role: 'assistant', content: '*"Coffee worth rooting for."*', created_at: t(6) },
  { id: 'n7', parent_id: 'n6', role: 'user',      content: 'Two more options?', created_at: t(7) },
  { id: 'n8', parent_id: 'n7', role: 'assistant', content: '- *"Grow your daily ritual."*\n- *"Leaf the rush behind."*', created_at: t(8) },

  // ── Plant-themed names ──
  { id: 'n9',  parent_id: 'n2', role: 'user',      content: 'Something plant-themed?', created_at: t(9) },
  { id: 'n10', parent_id: 'n9', role: 'assistant', content: 'Plant-themed:\n\n- **Fiddle & Fig**\n- **The Monstera**\n- **Photosynth Coffee**', created_at: t(10) },

  // ── Upscale names → pick a winner → the planning hub ──
  { id: 'n11', parent_id: 'n2',  role: 'user',      content: 'Go more upscale.', created_at: t(11) },
  { id: 'n12', parent_id: 'n11', role: 'assistant', content: 'Upscale:\n\n- **The Conservatory**\n- **Maison Verre**\n- **Atelier Brew**', created_at: t(12) },
  { id: 'n13', parent_id: 'n12', role: 'user',      content: '"The Conservatory" it is. Where do we start?', created_at: t(13) },
  { id: 'n14', parent_id: 'n13', role: 'assistant', content: 'Love it. We could shape the **menu**, the **interior**, the **brand voice**, or a **launch plan**. Which first?', created_at: t(14) },

  // ── Interior ──
  { id: 'n15', parent_id: 'n14', role: 'user',      content: 'The interior.', created_at: t(15) },
  { id: 'n16', parent_id: 'n15', role: 'assistant', content: 'Think glasshouse: rattan chairs, brass accents, hanging ferns, big skylights.', created_at: t(16) },
  { id: 'n17', parent_id: 'n16', role: 'user',      content: 'Best plants for low light?', created_at: t(17) },
  { id: 'n18', parent_id: 'n17', role: 'assistant', content: 'ZZ plant, pothos, and snake plant — all happy in low light.', created_at: t(18) },

  // ── Menu ──
  { id: 'n19', parent_id: 'n14', role: 'user',      content: 'The menu.', created_at: t(19) },
  { id: 'n20', parent_id: 'n19', role: 'assistant', content: 'Signatures:\n\n- **Fig & honey latte**\n- **Rosemary cold brew**\n- **Maple oat flat white**', created_at: t(20) },
  { id: 'n21', parent_id: 'n20', role: 'user',      content: 'A seasonal one for fall?', created_at: t(21) },
  { id: 'n22', parent_id: 'n21', role: 'assistant', content: '**Spiced pear cortado** — pear, cardamom, a touch of brown sugar.', created_at: t(22) },

  // ── Brand voice ──
  { id: 'n23', parent_id: 'n14', role: 'user',      content: 'The brand voice.', created_at: t(23) },
  { id: 'n24', parent_id: 'n23', role: 'assistant', content: 'Warm, witty, a little botanical. Palette: sage, cream, terracotta.', created_at: t(24) },

  // ── Launch plan ──
  { id: 'n25', parent_id: 'n14', role: 'user',      content: 'A launch plan.', created_at: t(25) },
  { id: 'n26', parent_id: 'n25', role: 'assistant', content: '- Soft open for the neighborhood\n- A free pour-over hour\n- A local-band weekend', created_at: t(26) },
  { id: 'n27', parent_id: 'n26', role: 'user',      content: 'On a tight budget?', created_at: t(27) },
  { id: 'n28', parent_id: 'n27', role: 'assistant', content: 'Skip ads: invite regulars, post one reel, team up with a nearby bakery.', created_at: t(28) },
]

// Authored titles/summaries for the tree cards (the real app generates these via
// /api/autotitle; here they're hand-written so the seeded canvas reads polished).
// Keyed by pair id = the assistant node's id.
export const SEED_META: Record<string, NodeMeta> = {
  n2:  { title: 'Name my coffee shop', summary: 'Three starters — playful, upscale, or plant-themed?' },
  n4:  { title: 'Playful names',       summary: 'Bean There, Leaf It to Me, Brew-ti-ful Day.' },
  n6:  { title: 'A tagline',           summary: '“Coffee worth rooting for.”' },
  n8:  { title: 'More taglines',       summary: '“Grow your daily ritual.” + one more.' },
  n10: { title: 'Plant-themed names',  summary: 'Fiddle & Fig, The Monstera, Photosynth.' },
  n12: { title: 'Upscale names',       summary: 'The Conservatory, Maison Verre, Atelier Brew.' },
  n14: { title: 'Where to start?',     summary: 'Menu, interior, brand voice, or launch?' },
  n16: { title: 'Interior vibe',       summary: 'Glasshouse: rattan, brass, hanging ferns.' },
  n18: { title: 'Low-light plants',    summary: 'ZZ plant, pothos, snake plant.' },
  n20: { title: 'Signature drinks',    summary: 'Fig & honey latte, rosemary cold brew…' },
  n22: { title: 'Fall special',        summary: 'Spiced pear cortado.' },
  n24: { title: 'Brand voice',         summary: 'Warm, witty, botanical. Sage + terracotta.' },
  n26: { title: 'Launch plan',         summary: 'Soft open, free pour-over hour, local band.' },
  n28: { title: 'Lean launch',         summary: 'Regulars, one reel, a bakery partner.' },
}

// Pre-applied node colors (hex, matching the app's palette), keyed by pair id.
// Each direction gets its own color so the canvas reads as organized work.
const VIOLET = '#8b5cf6', GREEN = '#22c55e', BLUE = '#3b82f6', ORANGE = '#f97316', INDIGO = '#6366f1', RED = '#ef4444'
export const SEED_COLORS: Record<string, string> = {
  // naming explorations
  n4: VIOLET, n6: VIOLET, n8: VIOLET,   // playful
  n10: GREEN,                            // plant-themed
  n12: BLUE,                             // upscale (the chosen line)
  // the four workstreams off the hub
  n16: BLUE,  n18: BLUE,                 // interior
  n20: ORANGE, n22: ORANGE,              // menu
  n24: INDIGO,                           // brand voice
  n26: RED,   n28: RED,                  // launch
}

// Pre-placed sticky notes pinned to the top corners of the board (flanking the
// root), within the tree's horizontal span so they stay fully in frame at the
// fitted zoom and never overlap a node.
export const DEMO_STICKIES: StickySeed[] = [
  { id: 's1', anchorPairId: 'n2', dx: -470, dy: 8, w: 188, h: 84, text: '★ love the\nplayful names!' },
  { id: 's2', anchorPairId: 'n2', dx: 470,  dy: 8, w: 196, h: 86, text: 'Start lean — add\npaid ads later 🚀' },
]

// Land on the deep interior branch: the chat shows that whole journey (name →
// upscale → "The Conservatory" → interior → plants) while six other directions
// sit preserved around it.
export const DEMO_INITIAL_SELECTED = 'n18'

// A visitor gets this many live prompts before the sign-up wall. Each reply is
// hard-capped short on the cheapest model, so the whole session is a tiny
// fraction of a cent.
export const DEMO_MESSAGE_LIMIT = 5

// Per-prompt character cap (also enforced server-side as a backstop).
export const DEMO_CHAR_LIMIT = 200
