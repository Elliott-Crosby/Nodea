// ─── Client-side Chat Project types ──────────────────────────────────────────
// Matches the row returned by /api/chat-projects (GET) — fields are computed
// server-side for chat_count / last_activity, so they're optional on writes.

export interface ChatProject {
  id: string
  name: string
  description: string
  /** Free-form context the user writes for the assistant. Injected into the
   *  system prompt for every conversation in this project. Editable inline on
   *  the project page. Defaults to ''. */
  memory: string
  icon: string
  color: string
  pinned: boolean
  created_at: string
  updated_at: string
  /** Number of conversations tagged with this project. */
  chat_count: number
  /** ISO timestamp of the most recently created conversation in this project, or null if empty. */
  last_activity: string | null
  /** Present on rows from /api/collab/shared: this project belongs to someone
   *  else and was shared with me. */
  shared?: boolean
  /** Owner id (present on shared rows). */
  user_id?: string
  /** Owner display name for "Shared by …" (shared rows only). */
  owner_name?: string | null
}

export type ProjectView = 'chat' | 'projects' | 'project'

/** Patch shape used when the parent saves a new project. */
export interface ChatProjectInput {
  name: string
  description: string
  icon: string
  color: string
}
