# Chrome Web Store — v0.3.0 multi-model update: PASTE-READY PACK

> **For the UPDATE that adds ChatGPT + Gemini.** Every field below is paste-ready and
> verified against the current `extension/` source. The dashboard **cannot be automated**
> ("The extensions gallery cannot be scripted" — Chrome blocks all extensions, including
> automation, from the Web Store + dev console), so this is the fast manual path.
>
> Dashboard: chrome.google.com/webstore/devconsole → your item (id `aofajhlefoaplghghaihgelegloicpnd`)
>
> **The name, version (0.3.0), and short description come from the ZIP's manifest — they
> auto-fill when you upload `nodea-tree-0.3.0.zip` on the Package tab. You don't paste those.**

---

## ORDER OF OPERATIONS (do top to bottom)

1. **Package tab** → "Upload new package" → upload `nodea-tree-0.3.0.zip`. Name + version + short description update automatically from the manifest.
2. **Store listing tab** → paste the Detailed description (§A). Update screenshots to show all three hosts (§F). Paste reviewer notes (§E, with a real test login).
3. **Privacy practices tab** → paste single purpose (§B), the permission justifications (§C), set Remote code = No (§D), tick the data boxes + 3 certifications (§G), confirm the privacy URL. Adding the new hosts will re-prompt justification here.
4. Confirm `https://nodea.ai/privacy` returns 200 (deploy the site first — it now describes all hosts).
5. **Save draft** → submit for review.

---

## §A. Detailed description  (Store listing tab → Description)

```
Claude, ChatGPT, and Gemini all quietly fork a new branch every time you edit a prompt or retry a reply — but they only show a tiny "‹ 2/3 ›" pager, if anything at all. Nodea Tree reads that hidden structure and draws it as a visual conversation map docked beside the chat: dotted-grid canvas, branch edges, zoomable node cards, and active-path highlighting.

• See every branch of a conversation at a glance — on claude.ai, chatgpt.com, and gemini.google.com.
• Click a node to jump to (Claude) or highlight that point in the chat.
• Branch from any node using Claude's own native controls (Claude today; ChatGPT and Gemini are visualize-only for now).
• "Open in Nodea" rebuilds the whole tree in the Nodea app (nodea.ai), preserving every branch and tagging it with the source (Claude / ChatGPT / Gemini).

Your data stays in your browser while you visualize. Conversation content is only sent to your own Nodea account when you explicitly click "Open in Nodea". See our privacy policy: https://nodea.ai/privacy

Not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or Google. "Claude" is a trademark of Anthropic, PBC; "ChatGPT" of OpenAI; "Gemini" of Google LLC.
```

---

## §B. Single purpose  (Privacy practices tab)

```
Nodea Tree visualizes the hidden branch tree of your AI chat conversations on claude.ai, chatgpt.com, and gemini.google.com. On each site it reads your open conversation — for Claude and ChatGPT from that service's own API using your existing login, and for Gemini (which exposes no API) from the page you are viewing — and draws it as a visual, color-codable conversation map docked beside the chat. On Claude you can also jump to a branch and start a new branch through Claude's own native edit/send controls. The map appears after you sign in to your Nodea account in the panel; once signed in, clicking "Open in Nodea" hands the branch tree to your own logged-in Nodea app so you can keep working with it there.
```

---

## §C. Permission justifications

### `storage`
```
The "storage" permission uses only chrome.storage.local for exactly three things. (1) nx_session: the extension's own Nodea account session — access token, refresh token, expiry, and the user's id and email — so the panel stays signed in across reloads and the login can carry over to the Nodea app tab. (2) nx_colors_<conversationId>: per-conversation node color choices, stored as id-to-hex color maps only (no message text), so the visual map keeps its colors between visits. (3) nx_import: a one-shot "Open in Nodea" handoff payload written only when the user clicks "Open in Nodea." It holds the conversation's branch tree — every node's id, parent id, role, created_at, and full message text (the user prompts and the assistant's replies), plus the conversation name and source ids — and is read once and then immediately deleted by the Nodea content script after delivery to the Nodea app.
```

### Host permissions (one block covering every host)
```
claude.ai/*: the content script is injected here to draw the branch map, and it makes a credentialed same-origin GET to Claude's own conversation API (GET /api/organizations and /api/organizations/{org}/chat_conversations/{id}?tree=True) to read the hidden branch tree with the user's existing cookies. The same host grant also backs the user-initiated write actions that stay on claude.ai — creating a fork by typing the user's own text into Claude's native composer/edit field. No analytics or extra data is sent to claude.ai.

chatgpt.com/* and chat.openai.com/*: the content script is injected to draw the branch map and to read the user's open ChatGPT conversation via ChatGPT's own API — a credentialed same-origin GET to /backend-api/conversation/{id}, authorized with a short-lived bearer token the page itself mints at /api/auth/session. This host is read-only (no writes). chat.openai.com is listed because ChatGPT is also served there.

gemini.google.com/*: Gemini exposes no conversation API, so the content script reads the conversation from the rendered page (the visible user prompts and model responses) to build the map. Injected here only to read the open conversation and draw the map. Read-only (no writes).

nodea.ai/* and www.nodea.ai/* (listed separately because Chrome does not treat www as equivalent to the bare domain): the bridge content script is injected into the user's own Nodea app to deliver the "Open in Nodea" tree and to carry the extension's login session over to the site, both via same-origin window.postMessage only. The Nodea tab is opened with noopener, so relaying the payload from chrome.storage through the bridge is the only delivery path.

kzqhpygdhphjaiymqcmq.supabase.co/*: this is the user's own Nodea account's Supabase auth backend (not a third-party, analytics, or developer-controlled endpoint). The service worker POSTs the user's Nodea email and password there only on explicit sign in / sign up / sign out / token refresh of the extension's own Nodea login, using the same public anon key the nodea.ai website ships. These auth calls run in the service worker because the chat sites' page CSP would block them from a content script.
```

---

## §D. Remote code

- **Answer: `No` — not using remote code.**
- Verified clean: zero `eval` / `new Function` / `importScripts(remote)` / `<script src>` / dynamic `import()` / Wasm. All network calls fetch JSON data only; all `innerHTML` uses local string literals (inline SVG icons), and message text is rendered with `textContent`, never injected as markup.

---

## §E. Notes for reviewers  (Store listing tab → "Notes for reviewers")

> ⚠️ Replace the two placeholders with a real, already-confirmed test Nodea login — the
> gated flow is not reviewable without it.

```
The branch map and the "Open in Nodea" handoff are hard-gated behind the extension's OWN Nodea login (a separate Nodea/Supabase account, NOT the chat site's session). Reviewing requires (a) being signed in to the chat site (claude.ai, chatgpt.com, or gemini.google.com) and (b) the test Nodea credentials below.

TEST NODEA LOGIN (required to review):
  Email: <<INSERT TEST NODEA EMAIL>>
  Password: <<INSERT TEST NODEA PASSWORD>>
Must be a real, already-confirmed Nodea account that can reach https://nodea.ai/app.

To test:
1. Sign in to any supported site and open a conversation. On claude.ai or chatgpt.com, edit or retry a message first to create branch siblings (a linear chat renders as a single chain). The Nodea dock appears on the right; the toolbar icon toggles it. The dock first shows the Nodea LOGIN screen.
2. Sign in to the test Nodea account in the dock. The branch tree appears only after this succeeds.
3. Click "Open in Nodea." A nodea.ai/app tab opens and the captured tree is imported, tagged with its source (Claude / ChatGPT / Gemini).

Data: the extension contacts only the chat site the user is on (their own account, read via existing session — Claude/ChatGPT via that service's API, Gemini via the page DOM) and kzqhpygdhphjaiymqcmq.supabase.co (Nodea's auth backend, same public anon key the website ships). No conversation content is sent to the developer or any analytics endpoint; it goes only to the user's own Nodea account on the explicit "Open in Nodea" click. Privacy policy: https://nodea.ai/privacy. Not affiliated with Anthropic, OpenAI, or Google.
```

---

## §F. Screenshots  (Store listing tab)

Replace the Claude-only shots with 1–5 at 1280×800 showing it's multi-model:
1. The map docked on a branched claude.ai conversation.
2. The map on a branched chatgpt.com conversation.
3. The map on a gemini.google.com conversation.
4. The "Open in Nodea" result in the Nodea app, with the source logo.

---

## §G. Data collection — tick exactly these 4 boxes

| Category | Tick? | Why (truthful) |
|---|---|---|
| Personally identifiable information | ✅ | Sign-in form collects your Nodea **email**. |
| Authentication information | ✅ | Sign-in form collects your Nodea **password** (used to authenticate, not stored); session tokens cached in `nx_session`. |
| Personal communications | ✅ | Reads the full text of Claude / ChatGPT / Gemini messages to build the tree. |
| Website content | ✅ | The conversation read on each host = website content. |
| Health / Financial / Location / Web history / User activity | ❌ | Not collected. |

**Certifications — check all three (all true):**
- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ✅ I do not use or transfer user data for purposes unrelated to my item's single purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending.

**Privacy policy URL:** `https://nodea.ai/privacy`  *(must be deployed + return 200 before submitting)*

> The contact email is already verified from the v0.2.0 submission — for this update you
> only need to re-check the final "I certify my data usage complies…" box on the Privacy tab.
