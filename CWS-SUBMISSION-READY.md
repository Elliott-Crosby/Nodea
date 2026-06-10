# Chrome Web Store — Privacy Practices: PASTE-READY PACK

> Verified against the actual `extension/` source (v0.2.0) by a 13-agent review pass.
> Open the **Privacy practices** tab of the dashboard and paste each block below.
> Dashboard: chrome.google.com/webstore/devconsole → Nodea Tree for Claude → **Privacy practices**

---

## 1. Single purpose

```
Nodea Tree for Claude works only on claude.ai. It reads your open Claude conversation's hidden branch tree from Claude's own API (using your existing claude.ai login) and draws it as a visual, color-codable conversation map docked beside the chat. From that map you can jump to any branch (it drives Claude's own controls to display it) and start a new branch from a chosen point, which is created through Claude's own native edit/send actions. The map appears after you sign in to your Nodea account in the panel; once signed in, clicking "Open in Nodea" hands the branch tree to your own logged-in Nodea app so you can keep working with it there.
```

---

## 2. Permission justification — `storage`

```
The "storage" permission uses only chrome.storage.local (no chrome.storage.sync and no chrome.storage.session) for exactly three things. (1) nx_session: the extension's own Nodea account session — access token, refresh token, expiry, and the user's id and email — so the panel stays signed in across reloads and the login can carry over to the Nodea app tab. (2) nx_colors_<conversationId>: per-conversation node color choices, stored as id-to-hex color maps only (no message text), so the visual map keeps its colors between visits. (3) nx_import: a one-shot "Open in Nodea" handoff payload written only when the user clicks "Open in Nodea." It holds the conversation's branch tree — every node's id, parent id, role, created_at, and full message text (the user prompts and Claude replies), plus the conversation name and source ids — and is read once and then immediately deleted by the Nodea content script after delivery to the Nodea app.
```

---

## 3. Host permission justification (one field, covers all 4 hosts)

```
claude.ai/*: the core feature. The content script is injected here to draw the branch map, and both the content script and the service worker make a credentialed same-origin GET to Claude's own conversation API (GET /api/organizations and /api/organizations/{org}/chat_conversations/{id}?tree=True) to read the hidden branch tree with the user's existing cookies; the service worker reuses this same host grant for the "Update Conversation" re-fetch. A cross-origin fetch from any other origin would be CORS-blocked and would not carry the user's Claude cookies. The same host grant also backs the user-initiated write actions that stay on claude.ai — creating a fork by typing the user's own text into Claude's native composer/edit field, and the optional, Nodea-page-gated "Push to Claude" reverse-sync, which drives an open claude.ai tab; no analytics or extra data is sent to claude.ai.

nodea.ai/* and www.nodea.ai/* (listed separately because Chrome does not treat www as equivalent to the bare domain): the bridge content script is injected into the user's own Nodea app to deliver the "Open in Nodea" tree and to carry the extension's login session over to the site, both via same-origin window.postMessage only. The Nodea tab is opened with noopener, so relaying the payload from chrome.storage through the bridge is the only delivery path.

kzqhpygdhphjaiymqcmq.supabase.co/*: this is the user's own Nodea account's Supabase auth backend (not a third-party, analytics, or developer-controlled endpoint). The service worker POSTs the user's Nodea email and password there only on explicit sign in / sign up / sign out / token refresh of the extension's own Nodea login, using the same public anon key the nodea.ai website ships. These auth calls run in the service worker because claude.ai's page CSP would block them from a content script.
```

> ⚠️ **One thing to confirm:** the paragraph above truthfully includes the **"Push to Claude" reverse-sync** write path because `claude-write.js` is still in the v0.2.0 zip. If the build you upload has that feature removed, delete the clause *"and the optional, Nodea-page-gated 'Push to Claude' reverse-sync, which drives an open claude.ai tab"* so the justification matches the shipped code.

---

## 4. Remote code

- **Answer: `No` — I am not using remote code.**
- Verified clean: zero `eval` / `new Function` / `importScripts(remote)` / `<script src>` / dynamic `import()` / Wasm. All network calls fetch **data (JSON)** only; all `innerHTML` uses local string literals (inline SVG icons), and Claude message text is rendered with `textContent`, never injected as markup.
- No justification text is needed when the answer is **No**.

---

## 5. Data collection — tick exactly these 4 boxes

| Category | Tick? | Why (truthful) |
|---|---|---|
| Personally identifiable information | ✅ | Sign-in form collects your Nodea **email**. |
| Authentication information | ✅ | Sign-in form collects your Nodea **password** (used to authenticate, not stored); session tokens cached in `nx_session`. |
| Personal communications | ✅ | Reads the full text of Claude messages to build the tree. |
| Website content | ✅ | Same Claude conversation read = website content. |
| Health information | ❌ | Not touched. |
| Financial and payment information | ❌ | Not touched. |
| Location | ❌ | Not touched. |
| Web history | ❌ | Not collected (only the active conversation id is parsed locally). |
| User activity | ❌ | UI listeners only; nothing logged/transmitted. |

**Compliance certifications — check all three (all true for this extension):**
- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** `https://nodea.ai/privacy`  *(must return 200 — confirm it's deployed live before submitting)*

---

## 6. Notes for reviewers  (Store listing tab → "Notes for reviewers")

> ⚠️ **You must replace the two placeholders with a real, already-confirmed test Nodea login** — the listing is not reviewable without it.

```
The branch map and the "Open in Nodea" handoff are both hard-gated behind the extension's OWN Nodea login (a separate Nodea/Supabase account, NOT the claude.ai cookie session). Reviewing therefore requires (a) a signed-in claude.ai account and (b) the test Nodea credentials below. Until the Nodea sign-in in Step 2 succeeds, the panel shows only the login screen and the tree stays hidden — so working credentials are required to review anything.

IMPORTANT — TEST NODEA LOGIN (the listing is not reviewable without it):
  Email: <<INSERT TEST NODEA EMAIL>>
  Password: <<INSERT TEST NODEA PASSWORD>>
This must be a real, already-confirmed Nodea account that can reach https://nodea.ai/app (a brand-new account pending email confirmation will not sign in).

To test:
1. Sign into claude.ai in the browser and open any conversation. The Nodea dock appears docked on the right of claude.ai conversation pages. (If you don't see it, click the extension's toolbar icon to toggle the dock.) At this point the dock shows the Nodea LOGIN screen, not the tree — the tree is gated on the Nodea sign-in in Step 2, not on the claude.ai login. To see a non-trivial branch shape, use a conversation that has at least one edited message or regenerated reply (that is what creates sibling branches in Claude's tree); a linear conversation will render as a single chain.
2. In the dock's login screen, sign into the extension's own Nodea account using the test credentials above (this is a separate Nodea/Supabase login, distinct from the claude.ai login). The branch tree appears only after this Nodea sign-in succeeds.
3. Click "Open in Nodea." A new nodea.ai/app tab opens; the extension stashes the captured tree in chrome.storage and the nodea.ai content-script bridge relays it into the logged-in Nodea app, which imports it. This demonstrates the full handoff.

Notes: The extension only contacts claude.ai (the reviewer's own Claude account, read-only via the user's existing cookies) and kzqhpygdhphjaiymqcmq.supabase.co (Nodea's auth backend, using the same public anon key the website ships). No conversation content is ever sent to the developer or any analytics endpoint; it goes only to the user's own Nodea account on the explicit "Open in Nodea" click. Privacy policy: https://nodea.ai/privacy. Not affiliated with Anthropic; "Claude" is Anthropic's trademark.
```

---

## 7. The two items NOT on the Privacy tab (Account / Settings)

These are why the dialog also listed "provide a contact email" and "verify the publisher's contact email":

1. Left sidebar → **Account** (or the gear → **Account**) → **Contact email** → enter your email (e.g. `nodea.ai@gmail.com`) → **Save**.
2. Google emails a verification link to that address → open it → click **Verify**. *(Only you can do this — it needs your inbox.)*
3. Back on the item → **Privacy practices** → check the final **"I certify that my data usage complies with the Developer Program Policies"** box.

---

## Final order of operations

1. Account settings: add + **verify** contact email.
2. Privacy practices tab: paste §1–§3, set Remote code = **No**, tick §5 data boxes + 3 certifications + final certify box.
3. Store listing tab: paste §6 reviewer notes (with a real test login filled in).
4. Confirm `https://nodea.ai/privacy` is live (200).
5. **Save draft** → the "Why can't I submit?" warnings should clear → **Submit for review**.
