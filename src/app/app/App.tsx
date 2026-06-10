'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { createClient } from '@/lib/supabase'
import { trackEvent } from '@/lib/track-event'
import Sidebar from './Sidebar'
import ChatPanel from './ChatPanel'
import TreePanel from './TreePanel'
import TreeSummaryCard from './TreeSummaryCard'
import SearchModal from './SearchModal'
import SettingsModal from './SettingsModal'
import UpgradeModal from './UpgradeModal'
import ProjectsLanding from './ProjectsLanding'
import ProjectPage from './ProjectPage'
import ProjectModal from './ProjectModal'
import DeleteProjectModal from './DeleteProjectModal'
import EditConversationModal from './EditConversationModal'
import ConvContextMenu from './ConvContextMenu'
import { MAX_PINNED_PROJECTS } from './projectConstants'
import type { ChatProject, ChatProjectInput, ProjectView } from './chatProjectTypes'
import { useIsMobile } from '@/lib/useIsMobile'
import MobileApp from './mobile/MobileApp'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  name: string
  user_id: string
  created_at: string
  /** Nullable FK into chat_projects. Null = unfiled. */
  chat_project_id: string | null
  /** Optional per-conversation color id (ROYGBIV palette). Null = no tint. */
  color?: string | null
  /** Origin tag when imported from an outside chat host via the browser
   *  extension (e.g. 'claude'). Null/absent = a native Nodea conversation. */
  source?: string | null
  /** The source host's id for this conversation — the key a later
   *  "Update Conversation" re-sync diffs against. */
  source_conversation_id?: string | null
}

// The payload the browser extension hands over via the Nodea-side bridge
// (extension/src/bridge.js → window.postMessage). One node per source message,
// carrying its native parent link so we can rebuild the exact branch tree.
export interface ExtImportNode {
  id: string
  parent_id: string | null
  role: string
  content: string
  created_at: string | null
}
// Where a logged-out import handoff is parked while the user signs in / signs
// up. The bridge clears chrome.storage once it delivers, so we stash the
// payload here ourselves and replay it after auth lands back on /app.
export const PENDING_IMPORT_KEY = 'nodea_pending_import'

export interface ExtImportPayload {
  v: number
  source?: string
  sourceConversationId?: string | null
  sourceOrgId?: string | null
  name?: string
  currentLeaf?: string | null
  selectedLeaf?: string | null
  nodes: ExtImportNode[]
}

// A source conversation's current tree, re-fetched by the extension when the
// user clicks "Update Conversation". Same node shape as an import.
export interface SourceTree {
  id?: string | null
  name?: string
  nodes: ExtImportNode[]
  currentLeaf?: string | null
}
export type UpdateResult = { ok: true; tree: SourceTree } | { ok: false; error: string }

export interface AttachmentItem {
  name: string
  type: string
  dataUrl: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  attachments?: AttachmentItem[]
  modelId?: string
  /** True when this node came from a third-party source (imported — it carries a
   *  source_message_id) rather than being generated natively in Nodea. Drives
   *  whether the reply wears the source's icon or its native Claude model logo. */
  imported?: boolean
}

export interface NodeAttachment {
  name: string
  type: string
  url?: string  // Supabase Storage URL — present once the file has been uploaded
}

// The ‹ n/m › prompt-version indicator. A user node's "versions" are its
// siblings — the other user nodes forked from the same parent (i.e. the edits).
export interface PromptVersionInfo {
  /** 0-based position of this prompt among its siblings (oldest → newest). */
  index: number
  /** Total number of sibling prompts (always ≥ 2 when this is non-null). */
  total: number
  /** Id of the previous / next sibling user node, or null at the ends. */
  prevId: string | null
  nextId: string | null
}

// ─── Attachment persistence ──────────────────────────────────────────────────
// We embed attachment metadata at the top of the node's `content` column with
// these markers, so attachments survive across branches without depending on
// a separate JSONB column (which would require a DB migration).

const ATT_MARK_OPEN  = '<<<NODEA_ATT_V1\n'
const ATT_MARK_CLOSE = '\nNODEA_ATT_V1>>>\n'

export function serializeUserContent(text: string, attachments: NodeAttachment[]): string {
  if (!attachments.length) return text
  return ATT_MARK_OPEN + JSON.stringify(attachments) + ATT_MARK_CLOSE + text
}

export function parseUserContent(content: string): { text: string; attachments: NodeAttachment[] } {
  if (!content.startsWith(ATT_MARK_OPEN)) return { text: content, attachments: [] }
  const closeIdx = content.indexOf(ATT_MARK_CLOSE, ATT_MARK_OPEN.length)
  if (closeIdx < 0) return { text: content, attachments: [] }
  const jsonStr = content.slice(ATT_MARK_OPEN.length, closeIdx)
  const text    = content.slice(closeIdx + ATT_MARK_CLOSE.length)
  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) return { text: content, attachments: [] }
    return { text, attachments: parsed.filter((a) => a && typeof a.name === 'string' && typeof a.type === 'string') }
  } catch {
    return { text: content, attachments: [] }
  }
}

// Take raw DbNode rows and surface the embedded attachment metadata onto the
// node itself, so TreePanel (which reads userNode.attachments) Just Works.
function enrichDbNodes(nodes: DbNode[]): DbNode[] {
  return nodes.map((n) => {
    // Normalize merge_sources to a clean non-empty string[] or drop it, so the
    // rest of the app never has to distinguish null vs [] vs malformed.
    const cleanMerges = Array.isArray(n.merge_sources)
      ? n.merge_sources.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    const base: DbNode = cleanMerges.length > 0
      ? { ...n, merge_sources: cleanMerges }
      : (n.merge_sources != null ? { ...n, merge_sources: undefined } : n)

    if (base.role !== 'user') return base
    if (base.attachments && base.attachments.length > 0) return base  // already populated from DB column
    const { attachments } = parseUserContent(base.content)
    return attachments.length > 0 ? { ...base, attachments } : base
  })
}

// Turn a DbNode into the ChatMessage shape the UI/API expect — strips the
// attachment header from content and lifts the attachments into a field.
function dbNodeToMessage(n: DbNode): ChatMessage {
  if (n.role === 'user') {
    const { text, attachments } = parseUserContent(n.content)
    return {
      id: n.id,
      role: 'user',
      content: text,
      timestamp: new Date(n.created_at).getTime(),
      attachments: attachments.length > 0
        ? attachments.map((a) => ({ name: a.name, type: a.type, dataUrl: a.url ?? '' }))
        : undefined,
    }
  }
  return {
    id: n.id, role: n.role, content: n.content,
    timestamp: new Date(n.created_at).getTime(),
    modelId: n.model_id ?? undefined,
    imported: !!n.source_message_id,
  }
}

// ── Imported-provenance fallback (works without the DB migration) ────────────
// The provenance columns (projects.source, nodes.source_message_id) aren't
// guaranteed to exist on the hosted DB — the import path degrades gracefully and
// drops them when they're absent. That would also drop the imported-source logo
// on the next refresh, since both signals come from those columns. To keep the
// source logo alive *forever* regardless of migration state, we mirror
// provenance into localStorage at import/sync time and reconstruct it on load.
// The real DB columns, when present, always take precedence (this is purely a
// fallback — it never overrides a node that already carries source_message_id).
const PROV_SRC_KEY   = (convId: string) => `nodea_prov_src_${convId}`
const PROV_NODES_KEY = (convId: string) => `nodea_prov_nodes_${convId}`

function readImportedSource(convId: string): string | null {
  try { return localStorage.getItem(PROV_SRC_KEY(convId)) || null } catch { return null }
}
function readImportedNodeIds(convId: string): string[] {
  try {
    const raw = localStorage.getItem(PROV_NODES_KEY(convId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
// Record (or extend) a conversation's imported provenance. `source` tags the
// host (e.g. 'claude'); `nodeIds` are the Nodea node ids that came from it. The
// node set is merged so a later "Update from source" only adds to it.
function rememberImportedProvenance(convId: string, source: string, nodeIds: string[]): void {
  try {
    localStorage.setItem(PROV_SRC_KEY(convId), source)
    const merged = Array.from(new Set([...readImportedNodeIds(convId), ...nodeIds]))
    localStorage.setItem(PROV_NODES_KEY(convId), JSON.stringify(merged))
  } catch {}
}
// Reconstruct a missing source_message_id from the localStorage fallback so the
// rest of the pipeline (dbNodeToMessage → `imported`) Just Works unchanged. A
// node that already has a real source_message_id (migrated DB) is left as-is.
function applyImportedProvenance(convId: string, nodes: DbNode[]): DbNode[] {
  const importedIds = new Set(readImportedNodeIds(convId))
  if (importedIds.size === 0) return nodes
  return nodes.map((n) =>
    n.source_message_id || !importedIds.has(n.id) ? n : { ...n, source_message_id: n.id },
  )
}

// ── Merge overlay helpers ────────────────────────────────────────────────────
// A merge converges other branches into a node WITHOUT changing parent_id. The
// link is stored as merge_sources on the node it merges into; these pure
// helpers resolve the structural tree (parent_id) only — one level deep, so the
// joined context can never cycle.

// Root→node chain (inclusive), walking up parent_id. Returns [] for a missing id.
function ancestorChain(nodeId: string | null, nodeMap: Map<string, DbNode>): DbNode[] {
  const out: DbNode[] = []
  let cur = nodeId ? nodeMap.get(nodeId) : undefined
  while (cur) {
    out.unshift(cur)
    cur = cur.parent_id ? nodeMap.get(cur.parent_id) : undefined
  }
  return out
}

// Whether `sourceNodeId` may be merged INTO `targetNodeId`. Rejects self, an
// already-recorded link, and anything that would create a context loop (source
// is an ancestor of target, or target is an ancestor of source).
function canMergeNodes(sourceNodeId: string, targetNodeId: string, nodeMap: Map<string, DbNode>): boolean {
  if (sourceNodeId === targetNodeId) return false
  const target = nodeMap.get(targetNodeId)
  const source = nodeMap.get(sourceNodeId)
  if (!target || !source) return false
  if (Array.isArray(target.merge_sources) && target.merge_sources.includes(sourceNodeId)) return false
  // source already on target's lineage → merge is a no-op / would loop
  if (ancestorChain(targetNodeId, nodeMap).some((n) => n.id === sourceNodeId)) return false
  // target on source's lineage → source is a descendant → would loop
  if (ancestorChain(sourceNodeId, nodeMap).some((n) => n.id === targetNodeId)) return false
  return true
}

// Soft cap on joined-transcript size so converging many branches can't blow the
// model's context window. Recency-biased: keep the most recent nodes.
const MERGE_CONTEXT_MAX_NODES = 80

// Assemble the model context for a send whose lineage involves merges. Unions
// the target's ancestor path with the full root→tip transcript of every merge
// source (explicit `extraMergeSources` from a brand-new merged prompt, plus any
// merge_sources carried on nodes already in the path), de-duplicated by id and
// ordered by created_at. The new user message goes last.
function buildMergedContext(
  allDbNodes: DbNode[],
  parentId: string | null,
  extraMergeSources: string[],
  userMsg: ChatMessage,
): ChatMessage[] {
  const nodeMap = new Map(allDbNodes.map((n) => [n.id, n]))
  const targetPath = ancestorChain(parentId, nodeMap)

  const sourceIds = new Set<string>(extraMergeSources)
  for (const n of targetPath) {
    if (Array.isArray(n.merge_sources)) n.merge_sources.forEach((id) => sourceIds.add(id))
  }

  const collected = new Map<string, DbNode>()
  for (const n of targetPath) collected.set(n.id, n)
  for (const srcId of sourceIds) {
    for (const n of ancestorChain(srcId, nodeMap)) collected.set(n.id, n)
  }

  const ordered = [...collected.values()].sort((a, b) => {
    const ta = +new Date(a.created_at)
    const tb = +new Date(b.created_at)
    if (ta !== tb) return ta - tb
    if (a.id === b.parent_id) return -1   // a user node sorts before its own reply on a timestamp tie
    if (b.id === a.parent_id) return 1
    return 0
  })

  const trimmed = ordered.length > MERGE_CONTEXT_MAX_NODES
    ? ordered.slice(ordered.length - MERGE_CONTEXT_MAX_NODES)
    : ordered
  return [...trimmed.map(dbNodeToMessage), userMsg]
}

// ── Per-fork branch memory ──────────────────────────────────────────────────
// Maps a parent node id → the child id last seen on the active path. Lets a
// return to a fork restore the branch you were most recently on, instead of an
// arbitrary sibling. Persisted per-conversation so it survives reloads.
function loadBranchChoices(convId: string): Map<string, string> {
  try {
    const raw = localStorage.getItem(`branchChoice_${convId}`)
    if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, string>))
  } catch {}
  return new Map()
}

function persistBranchChoices(convId: string, choices: Map<string, string>) {
  try {
    localStorage.setItem(`branchChoice_${convId}`, JSON.stringify(Object.fromEntries(choices)))
  } catch {}
}

// Record each parent→child step along a path as the most-recent choice, so
// navigating to a node makes its lineage the remembered branch at every fork.
function recordPathChoices(choices: Map<string, string>, path: DbNode[]) {
  for (const node of path) {
    if (node.parent_id) choices.set(node.parent_id, node.id)
  }
}

// Walk down from a node, taking the remembered branch at each fork and falling
// back to the newest child (children are sorted oldest→newest by caller).
function walkDownPreferred(
  childrenMap: Map<string, DbNode[]>,
  startId: string,
  choices: Map<string, string>,
): DbNode[] {
  const out: DbNode[] = []
  let tipId = startId
  while (true) {
    const children = childrenMap.get(tipId) ?? []
    if (children.length === 0) break
    const preferredId = choices.get(tipId)
    const next = (preferredId && children.find((c) => c.id === preferredId)) || children[children.length - 1]
    out.push(next)
    tipId = next.id
  }
  return out
}

export interface DbNode {
  id: string
  project_id: string
  parent_id: string | null
  role: 'user' | 'assistant'
  content: string
  position_x: number
  position_y: number
  created_at: string
  color?: string | null
  attachments?: NodeAttachment[] | null
  // Which AI model produced this assistant node, e.g. 'claude-sonnet-4-6'.
  // Persisted from the chat API's X-Model-Id header so the model name + logo on
  // a reply survive a refresh. Absent on user nodes and on pre-migration rows.
  model_id?: string | null
  // The source host's message id this node was imported from (e.g. a claude.ai
  // message). Present only on imported nodes — its presence is what marks a node
  // as third-party-sourced (vs. generated natively in Nodea), which drives the
  // per-message source icon.
  source_message_id?: string | null
  // Overlay "merge" links: ids of *other* nodes whose branches converge into
  // this one. Independent of parent_id — present only when the user merged
  // branches here. See the merge_sources migration. Lives on the user node of
  // a pair (the node that owns the next prompt's generation context).
  merge_sources?: string[] | null
}

// A reversible node deletion. We snapshot the deleted rows (parent-first, so a
// re-insert satisfies the parent→child link) plus where to re-focus, so Ctrl+Z
// or the undo toast can put them back exactly where they were.
interface UndoEntry {
  id: string
  convId: string
  nodes: DbNode[]
  focusId: string
}

export interface AppContextType {
  conversations: Conversation[]
  activeConvId: string | null
  convName: string
  allDbNodes: DbNode[]
  messages: ChatMessage[]
  selectedNodeId: string | null
  input: string
  setInput: (s: string) => void
  isLoading: boolean
  /** Conversation ids with an AI reply still streaming (incl. backgrounded ones). */
  inFlightConvIds: Set<string>
  isSearchOpen: boolean
  setIsSearchOpen: (b: boolean) => void
  isSettingsOpen: boolean
  setIsSettingsOpen: (b: boolean) => void
  isUpgradeOpen: boolean
  setIsUpgradeOpen: (b: boolean) => void
  isChatCollapsed: boolean
  setIsChatCollapsed: (b: boolean) => void
  handleSend: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleNodeClick: (nodeId: string) => Promise<void>
  /** Edit a prior user prompt: forks a new version from its parent and regenerates the reply. */
  editUserMessage: (userNodeId: string, newText: string) => Promise<void>
  /** Sibling-version info for a user prompt (the ‹ n/m › arrows), or null when it's the only version. */
  promptVersionInfo: (userNodeId: string) => PromptVersionInfo | null
  switchConversation: (id: string) => Promise<void>
  createConversation: () => Promise<void>
  renameConversation: (id: string, name: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  /** True when the active conversation was imported from an outside source — gates the Update button. */
  activeConvIsImported: boolean
  /** The active conversation's source key (e.g. 'claude') when imported, else null — picks the per-message source icon. */
  activeConvSource: string | null
  /** Pull any new branches from the active conversation's source (Claude), via the extension. */
  updateFromSource: () => Promise<void>
  /** True while an Update round-trip is in flight (drives the button's spinner). */
  isUpdatingSource: boolean
  signOut: () => void
  userEmail: string
  userName: string
  setUserName: (n: string) => void
  isAdmin: boolean
  isPro: boolean
  nodeColors: Record<string, string>
  setNodeColor: (id: string, color: string) => void
  /** Delete a prompt+reply pair. Returns false (no-op) if it has branches below. */
  deleteNode: (pairId: string) => Promise<boolean>
  // ── Merge overlay ──
  /** Whether `sourceNodeId` can be merged into `targetNodeId` (no self/cycle/dup). */
  canMergeInto: (sourceNodeId: string, targetNodeId: string) => boolean
  /** Record a merge link on `targetNodeId` (Flow B drag). Returns false on no-op/error. */
  addMergeSource: (targetNodeId: string, sourceNodeId: string) => Promise<boolean>
  /** Remove a merge link from `targetNodeId`. */
  removeMergeSource: (targetNodeId: string, sourceNodeId: string) => Promise<boolean>
  /** Arm a Flow-A merge: focus the anchor branch, converging the given tips into the next prompt. */
  beginMerge: (anchorTipId: string, mergeSourceIds: string[]) => Promise<void>
  /** Transient notice when a merge can't persist (column not migrated yet). */
  mergeNotice: string | null
  clearMergeNotice: () => void
  nodeSummaries: Record<string, { title: string; summary: string }>
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>
  pendingAttachments: AttachmentItem[]
  addAttachment: (a: AttachmentItem) => void
  removeAttachment: (name: string) => void
  lastSavedPairId: string | null
  chatError: string | null
  clearChatError: () => void
  saveError: boolean
  clearSaveError: () => void
  highlightedMessageId: string | null
  settingsInitialSection: string | null
  setSettingsInitialSection: (s: string | null) => void
  memorySavedByMsgId: Record<string, string[]>
  // ── Chat Projects feature ──
  chatProjects: ChatProject[]
  activeChatProjectId: string | null
  view: ProjectView
  openProjectsLanding: () => void
  openProject: (id: string) => void
  openChatView: (convId?: string) => void
  openNewProjectModal: () => void
  openConvContext: (conv: Conversation, x: number, y: number) => void
  openProjectContext: (project: ChatProject, x: number, y: number) => void
  assignConvToProject: (convId: string, projectId: string | null) => Promise<void>
  requestNewChatInProject: (projectId: string, initialMessage?: string) => Promise<void>
}

export const AppContext = createContext<AppContextType>({} as AppContextType)
export const useApp = () => useContext(AppContext)

class RateLimitError extends Error {
  readonly isRateLimit = true
  readonly limitType: string
  constructor(message: string, limitType: string) {
    super(message)
    this.limitType = limitType
  }
}

function formatRateLimitMessage(
  data: { limit_type?: string; resets_at?: string },
  isPro: boolean,
): string {
  if (data.limit_type === 'daily') {
    const t = data.resets_at
      ? new Date(data.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'midnight'
    return isPro
      ? `You've reached your daily usage limit. Your limit resets at ${t}.`
      : `You've reached your daily usage limit. Your limit resets at ${t}. Upgrade for more.`
  }
  if (data.limit_type === 'monthly') {
    const d = data.resets_at
      ? new Date(data.resets_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : 'the 1st'
    return isPro
      ? `You've reached your monthly usage limit. Your limit resets on ${d}.`
      : `You've reached your monthly usage limit. Your limit resets on ${d}. Upgrade for more.`
  }
  return 'Your message is too long. Please shorten it and try again.'
}

// ─── Tree layout (leaf-counting, Reingold-Tilford style) ─────────────────────

export function computeLayout(
  dbNodes: DbNode[],
  hSpacing = 220,
  vSpacing = 90,
): Map<string, { x: number; y: number }> {
  const childrenMap = new Map<string | null, DbNode[]>()
  for (const node of dbNodes) {
    const key = node.parent_id ?? null
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key)!.push(node)
  }
  for (const ch of childrenMap.values()) {
    ch.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  const positions = new Map<string, { x: number; y: number }>()
  let leafIdx = 0

  function walk(id: string, depth: number): number {
    const children = childrenMap.get(id) ?? []
    if (children.length === 0) {
      const x = leafIdx * hSpacing
      leafIdx++
      positions.set(id, { x, y: depth * vSpacing })
      return x
    }
    const xs = children.map((c) => walk(c.id, depth + 1))
    const x = (xs[0] + xs[xs.length - 1]) / 2
    positions.set(id, { x, y: depth * vSpacing })
    return x
  }

  for (const root of childrenMap.get(null) ?? []) walk(root.id, 0)
  return positions
}

export function truncate(str: string, max = 65) {
  return str.length <= max ? str : str.slice(0, max) + '…'
}

// ─── Model map ───────────────────────────────────────────────────────────────

// ─── Main component ───────────────────────────────────────────────────────────

export default function App() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  // Mobile-only: below the breakpoint we swap the three-panel desktop layout for
  // a touch-native UI. Everything still runs on the same context/state below.
  const isMobile = useIsMobile()

  const [conversations, setConversations]   = useState<Conversation[]>([])
  const [activeConvId,  setActiveConvId]    = useState<string | null>(null)
  const [convName,      setConvName]        = useState('Loading…')
  const [allDbNodes,    setAllDbNodes]      = useState<DbNode[]>([])
  const [messages,      setMessages]        = useState<ChatMessage[]>([])
  const [selectedNodeId,setSelectedNodeId]  = useState<string | null>(null)
  const [isCurrentLoaded, setIsCurrentLoaded] = useState(false)
  const [input,         setInputState]      = useState('')
  // Conversations with an in-flight AI response. The state mirror drives the
  // sidebar "generating" indicator; the ref below is the synchronous source of
  // truth read from async closures and cleanup guards.
  const [inFlightConvIds, setInFlightConvIds] = useState<Set<string>>(() => new Set())
  const [isSearchOpen,  setIsSearchOpen]    = useState(false)
  const [isSettingsOpen,setIsSettingsOpen]  = useState(false)
  const [isUpgradeOpen, setIsUpgradeOpen]  = useState(false)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | null>(null)
  const [userEmail,     setUserEmail]       = useState('')
  const [userName,      setUserName]        = useState('')
  // Flips true once the user is confirmed signed in (and named). Gates the
  // replay of a parked extension import — see PENDING_IMPORT_KEY.
  const [authedReady,   setAuthedReady]     = useState(false)
  const [isAdmin,       setIsAdmin]         = useState(false)
  const [isPro,         setIsPro]           = useState(false)
  const [nodeColors,    setNodeColors]      = useState<Record<string, string>>({})
  const [nodeSummaries, setNodeSummaries]   = useState<Record<string, { title: string; summary: string }>>({})
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([])
  const [lastSavedPairId, setLastSavedPairId] = useState<string | null>(null)
  const [chatError,     setChatError]       = useState<string | null>(null)
  const [saveError,     setSaveError]       = useState(false)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  // Indicators for "saved to memory" lines under assistant messages. Keyed by
  // the local (session) message id, so the badge appears immediately after a
  // save and naturally disappears when the conv reloads from DB on switch.
  const [memorySavedByMsgId, setMemorySavedByMsgId] = useState<Record<string, string[]>>({})

  // ─── Chat Projects feature state ──────────────────────────────────────────
  const [chatProjects, setChatProjects] = useState<ChatProject[]>([])
  const [activeChatProjectId, setActiveChatProjectId] = useState<string | null>(null)
  const [view, setView] = useState<ProjectView>('chat')

  // Modal state
  const [projectModalState, setProjectModalState] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; project: ChatProject }
    | null
  >(null)
  const [deleteProjectState, setDeleteProjectState] = useState<ChatProject | null>(null)
  const [editConvState, setEditConvState] = useState<Conversation | null>(null)

  // Context menus
  const [convMenu, setConvMenu] = useState<{ conv: Conversation; x: number; y: number } | null>(null)
  const [projectMenu, setProjectMenu] = useState<{ project: ChatProject; x: number; y: number } | null>(null)

  // Undo: drives the bottom toast after a node deletion. The full history lives
  // in undoStackRef (a ref, so pushing/popping doesn't re-render); the toast
  // only needs to know which entry it's currently offering to undo.
  const [undoToast, setUndoToast] = useState<{ id: string } | null>(null)

  // A brief notice for merge actions that can't persist yet (the merge_sources
  // column hasn't been migrated). Distinct from saveError so a missing column
  // doesn't read as "your message failed to save".
  const [mergeNotice, setMergeNotice] = useState<string | null>(null)
  const mergeNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A pending Flow-A merge: the anchor parent the new prompt forks from, plus
  // the other branch tips to converge. Consumed by the next handleSend, which
  // persists them on the new user node and joins their transcripts into context.
  const pendingMergeRef = useRef<{ parentId: string; mergeSources: string[] } | null>(null)

  const lastNodeIdRef     = useRef<string | null>(null)
  const isBranchPointRef  = useRef(false)
  const branchChoiceRef   = useRef<Map<string, string>>(new Map())
  const chatInputRef      = useRef<HTMLTextAreaElement | null>(null)
  // The prompt typed on a project's "start a new chat" input, stashed by
  // requestNewChatInProject and delivered into the composer once the new
  // conversation has loaded (see the effect below handleSend).
  const pendingProjectMsgRef = useRef<string | null>(null)
  // Content for a programmatic send (the project "start a new chat" prompt),
  // set synchronously right before form.requestSubmit(). handleSend reads this
  // instead of `input` so delivery never depends on React having committed the
  // setInput() that precedes the submit — otherwise the rAF-driven submit can
  // race ahead of the state update and send an empty message.
  const forcedSendRef = useRef<string | null>(null)
  // Mirror of activeConvId, readable from async closures (saveUserNode /
  // saveAssistantNode) so we can tell if the user has navigated away by the
  // time a save resolves.
  const activeConvIdRef   = useRef<string | null>(null)
  // Synchronous mirror of `inFlightConvIds`, safe to read inside async closures
  // (a finished stream) and cleanup guards (deleteIfEmpty) where state may be stale.
  const inFlightRef       = useRef<Set<string>>(new Set())
  // Recent reversible deletions (most-recent last). Capped so Ctrl+Z only ever
  // reaches back over "the last few actions", not the whole session.
  const undoStackRef        = useRef<UndoEntry[]>([])
  const undoSeqRef          = useRef(0)
  const undoToastTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearChatError  = useCallback(() => setChatError(null), [])
  const clearSaveError  = useCallback(() => setSaveError(false), [])
  const clearMergeNotice = useCallback(() => setMergeNotice(null), [])

  // Surface a transient notice when a merge can't persist (column not migrated).
  const notifyMergeUnavailable = useCallback(() => {
    if (mergeNoticeTimerRef.current) clearTimeout(mergeNoticeTimerRef.current)
    setMergeNotice('Merging needs a database update before it can be saved.')
    mergeNoticeTimerRef.current = setTimeout(() => setMergeNotice(null), 4000)
  }, [])
  useEffect(() => () => { if (mergeNoticeTimerRef.current) clearTimeout(mergeNoticeTimerRef.current) }, [])

  useEffect(() => { activeConvIdRef.current = activeConvId }, [activeConvId])

  // Mark/unmark a conversation as generating. The ref updates synchronously for
  // guards; the state mirror re-renders the sidebar indicator.
  const markInFlight = useCallback((id: string) => {
    inFlightRef.current.add(id)
    setInFlightConvIds(new Set(inFlightRef.current))
  }, [])
  const clearInFlight = useCallback((id: string) => {
    inFlightRef.current.delete(id)
    setInFlightConvIds(new Set(inFlightRef.current))
  }, [])

  // Only the conversation currently on screen drives the composer/tree "busy"
  // state — others generate quietly in the background.
  const isLoading = activeConvId !== null && inFlightConvIds.has(activeConvId)

  // Global, persistent input draft — survives conv switches and reloads.
  const setInput = useCallback((s: string) => {
    setInputState(s)
    try {
      if (s) localStorage.setItem('nodea_input_draft', s)
      else localStorage.removeItem('nodea_input_draft')
    } catch {}
  }, [])

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nodea_input_draft')
      if (saved) setInputState(saved)
    } catch {}
  }, [])

  const addAttachment = useCallback((a: AttachmentItem) => {
    setPendingAttachments((prev) => [...prev, a])
  }, [])

  const removeAttachment = useCallback((name: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.name !== name))
  }, [])

  // ── Node color — persist to DB (Task 1) ───────────────────────────────────
  const setNodeColor = useCallback((id: string, color: string) => {
    setNodeColors((prev) => ({ ...prev, [id]: color }))
    supabase
      .from('nodes')
      .update({ color: color || null })
      .eq('id', id)
      .then(({ error }) => { if (error) console.error('Color save failed', error) })
  }, [supabase])

  // ── Load conversation from DB into state ──────────────────────────────────
  const loadConversation = useCallback(
    async (convId: string, name: string) => {
      setIsCurrentLoaded(false)
      setActiveConvId(convId)
      localStorage.setItem('lastConvId', convId)
      setConvName(name)
      setMessages([])
      setSelectedNodeId(null)
      setNodeColors({})
      setNodeSummaries({})
      setHighlightedMessageId(null)
      setMemorySavedByMsgId({})
      lastNodeIdRef.current = null
      branchChoiceRef.current = loadBranchChoices(convId)

      const { data: dbNodes, error } = await supabase
        .from('nodes')
        .select('*')
        .eq('project_id', convId)
        .order('created_at', { ascending: true })

      if (error || !dbNodes?.length) {
        setAllDbNodes([])
        setIsCurrentLoaded(true)
        return
      }

      // Reconstruct any imported provenance the hosted DB couldn't persist
      // (missing source_message_id column) from the localStorage fallback, so
      // the imported-source logo survives a refresh regardless of migration.
      const enriched = applyImportedProvenance(convId, enrichDbNodes(dbNodes as DbNode[]))
      setAllDbNodes(enriched)

      // Restore persisted node colors
      const colorMap: Record<string, string> = {}
      for (const n of enriched) {
        if (n.color) colorMap[n.id] = n.color
      }
      setNodeColors(colorMap)

      // Restore AI-generated titles/summaries from localStorage
      const metaMap: Record<string, { title: string; summary: string }> = {}
      for (const n of enriched) {
        if (n.role === 'assistant') {
          try {
            const cached = localStorage.getItem(`node_meta_v1_${n.id}`)
            if (cached) metaMap[n.id] = JSON.parse(cached)
          } catch {}
        }
      }
      setNodeSummaries(metaMap)

      const nodeMap = new Map(enriched.map((n) => [n.id, n]))
      const savedNodeId = localStorage.getItem(`lastNodeId_${convId}`)
      const savedNode = savedNodeId ? nodeMap.get(savedNodeId) : undefined
      const assistantNodes = enriched.filter((n) => n.role === 'assistant')
      const targetNode = savedNode ?? (assistantNodes.length ? assistantNodes[assistantNodes.length - 1] : undefined)
      if (targetNode) {
        setSelectedNodeId(targetNode.id)

        // Walk UP: ancestors from root to target node (inclusive)
        const ancestors: DbNode[] = []
        let cur: DbNode | undefined = targetNode
        while (cur) {
          ancestors.unshift(cur)
          cur = cur.parent_id ? nodeMap.get(cur.parent_id) : undefined
        }

        // Build children map so we can walk DOWN (use the provenance-enriched
        // nodes so descendants carry source_message_id like the ancestors do).
        const childrenMap = new Map<string, DbNode[]>()
        for (const node of enriched) {
          if (node.parent_id) {
            if (!childrenMap.has(node.parent_id)) childrenMap.set(node.parent_id, [])
            childrenMap.get(node.parent_id)!.push(node)
          }
        }
        for (const children of childrenMap.values()) {
          children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }

        // Walk DOWN from target node, following the most recently visited
        // branch at each fork (newest child when never visited).
        const descendants = walkDownPreferred(childrenMap, targetNode.id, branchChoiceRef.current)
        recordPathChoices(branchChoiceRef.current, [...ancestors, ...descendants])
        persistBranchChoices(convId, branchChoiceRef.current)

        // Highlight the user prompt that produced the selected node
        let highlightId: string | null = null
        if (targetNode.role === 'assistant') {
          const userParent = targetNode.parent_id ? nodeMap.get(targetNode.parent_id) : null
          highlightId = userParent?.id ?? null
        } else {
          highlightId = targetNode.id
        }
        setHighlightedMessageId(highlightId)

        const lastAsst = [...ancestors].reverse().find((n) => n.role === 'assistant')
        if (lastAsst) lastNodeIdRef.current = lastAsst.id

        setMessages([...ancestors, ...descendants].map(dbNodeToMessage))
      }
      setIsCurrentLoaded(true)
    },
    [supabase]
  )

  // ─── Import a conversation handed over by the browser extension ────────────
  // The "Nodea Tree for Claude" extension stashes a full Claude branch tree and
  // opens this app; its Nodea-side bridge (extension/src/bridge.js) relays the
  // tree here via postMessage. We rebuild it as a real Nodea conversation —
  // every branch, parent links preserved — stamping each node with its Claude
  // message id so a later "Update Conversation" can diff against the original.
  // Insert is client-side (same RLS path as normal chat) and mirrors the
  // graceful-degrade pattern used for attachments / merge_sources: if the
  // provenance columns aren't migrated yet, retry without them so it still lands.
  const [importNotice, setImportNotice] = useState<{ text: string; tone: 'info' | 'error' } | null>(null)
  const importNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const importingRef = useRef(false)
  // Set when the extension bridge announces itself — lets Update fail fast with
  // an "install the extension" hint instead of waiting out the full timeout.
  const extPresentRef = useRef(false)

  const showImportNotice = useCallback((text: string, tone: 'info' | 'error' = 'info', ms = 4500) => {
    if (importNoticeTimerRef.current) clearTimeout(importNoticeTimerRef.current)
    setImportNotice({ text, tone })
    importNoticeTimerRef.current = setTimeout(() => setImportNotice(null), ms)
  }, [])
  const clearImportNotice = useCallback(() => {
    if (importNoticeTimerRef.current) clearTimeout(importNoticeTimerRef.current)
    setImportNotice(null)
  }, [])
  useEffect(() => () => { if (importNoticeTimerRef.current) clearTimeout(importNoticeTimerRef.current) }, [])

  // ── Login carry-over from the extension ────────────────────────────────────
  // The extension holds its OWN Supabase session (chrome.storage `nx_session`),
  // separate from this site's cookie session. When it opens "Open in Nodea" the
  // user may be signed in there but not here. Give its bridge a brief window to
  // hand that session over (postMessage `auth-session`) and adopt it onto this
  // site — setSession writes the auth cookies, so /api routes authenticate too.
  // Resolves true if a session was adopted. See extension/src/bridge.js.
  const adoptExtensionSession = useCallback((timeoutMs = 3000): Promise<boolean> => {
    return new Promise((resolve) => {
      let done = false
      const finish = (v: boolean) => {
        if (done) return
        done = true
        window.removeEventListener('message', onMsg)
        clearTimeout(timer)
        resolve(v)
      }
      async function onMsg(e: MessageEvent) {
        if (e.source !== window || e.origin !== window.location.origin) return
        const d = e.data as { __nodea?: string; session?: { access_token?: string; refresh_token?: string } } | null
        if (!d || d.__nodea !== 'auth-session') return
        const s = d.session
        if (!s?.access_token || !s?.refresh_token) return finish(false)
        const { error } = await supabase.auth.setSession({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
        })
        if (error) console.warn('[Nodea auth] extension session rejected', error.message)
        finish(!error)
      }
      window.addEventListener('message', onMsg)
      // Ask the extension (if installed) to hand over its session.
      window.postMessage({ __nodea: 'request-auth' }, window.location.origin)
      const timer = setTimeout(() => finish(false), timeoutMs)
    })
  }, [supabase])

  const importConversation = useCallback(async (raw: unknown) => {
    const p = raw as ExtImportPayload | null
    // Only act on our v1 import shape.
    if (!p || p.v !== 1 || !Array.isArray(p.nodes) || p.nodes.length === 0) {
      console.warn('[Nodea import] ignored payload (wrong shape)', raw)
      return
    }
    if (importingRef.current) return
    importingRef.current = true
    console.info('[Nodea import] received', p.nodes.length, 'nodes from', p.source)
    const isColumnError = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204'
    try {
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // The extension launched us — it may be signed in even though this site
        // isn't. Give it a moment to hand over its session before the login wall.
        if (await adoptExtensionSession()) {
          ;({ data: { user } } = await supabase.auth.getUser())
        }
      }
      if (!user) {
        // Require a Nodea account, but don't make them re-open from Claude:
        // park the tree and replay it once they're back on /app signed in.
        console.warn('[Nodea import] not signed in — parking import and routing to login')
        try { sessionStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(p)) } catch {}
        showImportNotice('Sign in or create a free account to finish importing.', 'info', 5000)
        router.push('/login')
        return
      }

      const source = typeof p.source === 'string' ? p.source : 'claude'
      const sourceConvId = p.sourceConversationId ?? null
      const name = (typeof p.name === 'string' && p.name.trim()) || 'Imported conversation'

      // Carrying the same Claude conversation over again makes a fresh copy —
      // imports aren't synced in place. (Each copy stays independently linked to
      // its source, so the in-app "Update" button can still pull new branches
      // into it; a re-import is always a new copy, never a merge.)

      // 1) Create the conversation via the API route. Conversations are created
      //    server-side (a client-side INSERT into projects is blocked by RLS —
      //    the app always uses /api/projects). Pass provenance fields in the
      //    same request so they're written atomically in the INSERT — no
      //    separate UPDATE step that can silently no-op pre-migration.
      const provenance: Record<string, unknown> = {
        source,
        source_conversation_id: sourceConvId,
        source_org_id: p.sourceOrgId ?? null,
        source_leaf_id: p.currentLeaf ?? null,
        source_synced_at: new Date().toISOString(),
      }
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...provenance }),
      })
      if (!createRes.ok) {
        console.error('[Nodea import] create conversation failed', createRes.status)
        showImportNotice('Import failed: could not create the conversation.', 'error', 6000)
        return
      }
      const created = await createRes.json().catch(() => null)
      const projectId: string | undefined = created?.project?.id
      if (!projectId) {
        console.error('[Nodea import] create conversation returned no id', created)
        showImportNotice('Import failed: could not create the conversation.', 'error', 6000)
        return
      }
      // Patch provenance (best-effort; whole update no-ops pre-migration).
      const { error: provErr } = await supabase.from('projects').update(provenance).eq('id', projectId)
      if (provErr && !isColumnError(provErr)) console.warn('[Nodea import] provenance update failed', provErr)

      // 2) Rebuild the node tree. A fresh uuid per source node lets us set
      //    parent links without round-trips; preserve role, content, and Claude
      //    timestamps (load orders by created_at) and stamp source_message_id.
      const idMap = new Map<string, string>()
      for (const n of p.nodes) if (n && typeof n.id === 'string') idMap.set(n.id, crypto.randomUUID())
      type Row = Record<string, unknown> & { id: string; parent_id: string | null }
      const rows: Row[] = []
      for (const n of p.nodes) {
        if (!n || typeof n.id !== 'string') continue
        const row: Row = {
          id: idMap.get(n.id)!,
          project_id: projectId,
          parent_id: (n.parent_id && idMap.get(n.parent_id)) || null,
          role: n.role === 'assistant' ? 'assistant' : 'user',
          content: typeof n.content === 'string' ? n.content : '',
          position_x: 0,
          position_y: 0,
          source_message_id: n.id,
        }
        if (typeof n.created_at === 'string' && n.created_at) row.created_at = n.created_at
        rows.push(row)
      }
      // Parent-first order so the self-referential FK is satisfied on insert.
      const byId = new Map(rows.map((r) => [r.id, r]))
      const ordered: Row[] = []
      const done = new Set<string>(), busy = new Set<string>()
      const visit = (r: Row) => {
        if (done.has(r.id) || busy.has(r.id)) return
        busy.add(r.id)
        const parent = r.parent_id ? byId.get(r.parent_id) : undefined
        if (parent) visit(parent)
        busy.delete(r.id); done.add(r.id); ordered.push(r)
      }
      for (const r of rows) visit(r)

      let { error: nodesErr } = await supabase.from('nodes').insert(ordered)
      if (isColumnError(nodesErr)) {
        const stripped = ordered.map((r) => { const c = { ...r }; delete c.source_message_id; return c })
        ;({ error: nodesErr } = await supabase.from('nodes').insert(stripped))
      }
      if (nodesErr) {
        console.error('import: nodes insert failed', nodesErr)
        // Don't leave an empty husk conversation behind.
        await supabase.from('projects').delete().eq('id', projectId)
        showImportNotice('Import failed: could not save the messages.', 'error', 6000)
        return
      }

      // Mirror provenance into localStorage so the imported-source logo survives
      // a refresh even when the DB lacks the source columns. Every node in this
      // tree came from the source, so the whole set is imported.
      rememberImportedProvenance(projectId, source, ordered.map((r) => r.id))

      // 3) Land on the same node the user was looking at in Claude.
      const leafSource = p.selectedLeaf || p.currentLeaf
      const leafNew = (leafSource && idMap.get(leafSource)) || null
      if (leafNew) { try { localStorage.setItem(`lastNodeId_${projectId}`, leafNew) } catch {} }

      const newConv: Conversation = {
        id: projectId, name, user_id: user.id,
        created_at: new Date().toISOString(),
        chat_project_id: null, color: null,
        source, source_conversation_id: sourceConvId,
      }
      setConversations((prev) => (prev.some((c) => c.id === projectId) ? prev : [...prev, newConv]))
      await loadConversation(projectId, name)
      console.info('[Nodea import] done —', ordered.length, 'nodes into', projectId)
      showImportNotice(`Imported “${name}” from Claude ✓`, 'info', 4500)
      try { track('conversation_imported', { source, nodes: ordered.length }) } catch {}
    } catch (e) {
      console.error('import failed', e)
      showImportNotice('Import failed. See the console for details.', 'error', 6000)
    } finally {
      importingRef.current = false
    }
  }, [supabase, loadConversation, showImportNotice, router, adoptExtensionSession])

  // Listen for the extension bridge handing over a tree. The handshake is
  // two-way (each side pings on load and answers the other) so it works no
  // matter which loaded first; see extension/src/bridge.js.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== window || e.origin !== window.location.origin) return
      const d = e.data as { __nodea?: string; payload?: unknown } | null
      if (!d || typeof d !== 'object') return
      if (d.__nodea === 'ext-present') {
        extPresentRef.current = true
      } else if (d.__nodea === 'ext-ready') {
        extPresentRef.current = true
        window.postMessage({ __nodea: 'app-ready' }, window.location.origin)
      } else if (d.__nodea === 'import-data' && d.payload) {
        console.info('[Nodea import] bridge delivered a tree')
        void importConversation(d.payload)
      }
    }
    window.addEventListener('message', onMessage)
    // Announce we're listening (delivers any pending import) and probe for the
    // extension (the bridge answers a ping with 'ext-present').
    window.postMessage({ __nodea: 'app-ready' }, window.location.origin)
    window.postMessage({ __nodea: 'ping' }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [importConversation])

  // Replay an import that was parked because the user wasn't signed in when the
  // extension handed it over. Runs once auth is confirmed (post login/signup).
  useEffect(() => {
    if (!authedReady) return
    let parked: string | null = null
    try { parked = sessionStorage.getItem(PENDING_IMPORT_KEY) } catch {}
    if (!parked) return
    try { sessionStorage.removeItem(PENDING_IMPORT_KEY) } catch {}
    try {
      console.info('[Nodea import] replaying parked import after sign-in')
      void importConversation(JSON.parse(parked))
    } catch {
      // Corrupt payload — nothing to replay.
    }
  }, [authedReady, importConversation])

  // ─── "Update Conversation": pull new branches from the source (Stage 2) ────
  // Only the extension can reach Claude, so we ask it (via the bridge) to
  // re-fetch the original tree, then diff by source_message_id and append
  // what's new. Append-only and non-destructive: branches deleted in Claude
  // stay in Nodea, and in-place text edits aren't patched (Claude forks edits
  // into new messages, so those arrive as new nodes anyway).
  const [isUpdatingSource, setIsUpdatingSource] = useState(false)

  // Ask the extension bridge for a source conversation's current tree. Resolves
  // with the tree or an error; times out if no extension answers.
  const requestSourceTree = useCallback(
    (sourceConversationId: string, sourceOrgId: string | null, source: string, timeoutMs = 15000): Promise<UpdateResult> =>
      new Promise<UpdateResult>((resolve) => {
        const requestId = crypto.randomUUID()
        let settled = false
        const finish = (r: UpdateResult) => {
          if (settled) return
          settled = true
          window.removeEventListener('message', onMsg)
          resolve(r)
        }
        function onMsg(e: MessageEvent) {
          if (e.source !== window || e.origin !== window.location.origin) return
          const d = e.data as { __nodea?: string; requestId?: string; ok?: boolean; tree?: SourceTree; error?: string } | null
          if (!d || d.__nodea !== 'update-result' || d.requestId !== requestId) return
          finish(d.ok && d.tree ? { ok: true, tree: d.tree } : { ok: false, error: d.error || 'fetch failed' })
        }
        window.addEventListener('message', onMsg)
        window.postMessage({ __nodea: 'update-request', requestId, sourceConversationId, sourceOrgId, source }, window.location.origin)
        setTimeout(() => finish({ ok: false, error: 'timeout' }), timeoutMs)
      }),
    [],
  )

  // Diff a freshly-fetched source tree against what's already in the Nodea
  // conversation and insert only the new nodes, preserving parent links.
  const applySourceTree = useCallback(
    async (convId: string, tree: SourceTree): Promise<{ status: 'ok' | 'unlinked'; added: number }> => {
      const isColumnError = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204'
      const { data: existingRows, error: exErr } = await supabase
        .from('nodes').select('id, source_message_id').eq('project_id', convId)
      // Pre-migration DB has no source_message_id column, so there's no reliable
      // key to diff the source tree against — degrade to "unlinked" instead of
      // throwing (the imported logo still persists via the localStorage fallback).
      if (exErr && isColumnError(exErr)) return { status: 'unlinked', added: 0 }
      if (exErr) { console.error('update: load existing failed', exErr); throw new Error('db') }

      // source message id → existing Nodea node id.
      const sourceToNodea = new Map<string, string>()
      for (const r of (existingRows || []) as { id: string; source_message_id: string | null }[]) {
        if (r.source_message_id) sourceToNodea.set(r.source_message_id, r.id)
      }
      // Imported before provenance existed → no ids to diff against safely.
      if ((existingRows?.length ?? 0) > 0 && sourceToNodea.size === 0) return { status: 'unlinked', added: 0 }

      const incoming = (tree.nodes || []).filter((n) => n && typeof n.id === 'string')
      const newOnes = incoming.filter((n) => !sourceToNodea.has(n.id))
      if (newOnes.length === 0) return { status: 'ok', added: 0 }
      for (const n of newOnes) sourceToNodea.set(n.id, crypto.randomUUID())

      type Row = Record<string, unknown> & { id: string; parent_id: string | null }
      const rows: Row[] = newOnes.map((n) => {
        const row: Row = {
          id: sourceToNodea.get(n.id)!,
          project_id: convId,
          parent_id: (n.parent_id && sourceToNodea.get(n.parent_id)) || null,
          role: n.role === 'assistant' ? 'assistant' : 'user',
          content: typeof n.content === 'string' ? n.content : '',
          position_x: 0,
          position_y: 0,
          source_message_id: n.id,
        }
        if (typeof n.created_at === 'string' && n.created_at) row.created_at = n.created_at
        return row
      })
      // Parent-first (a new node's parent may be another new node in this batch).
      const byId = new Map(rows.map((r) => [r.id, r]))
      const ordered: Row[] = []; const done = new Set<string>(); const busy = new Set<string>()
      const visit = (r: Row) => {
        if (done.has(r.id) || busy.has(r.id)) return
        busy.add(r.id)
        const par = r.parent_id ? byId.get(r.parent_id) : undefined
        if (par) visit(par)
        busy.delete(r.id); done.add(r.id); ordered.push(r)
      }
      for (const r of rows) visit(r)

      let { error: insErr } = await supabase.from('nodes').insert(ordered)
      if (isColumnError(insErr)) {
        const stripped = ordered.map((r) => { const c = { ...r }; delete c.source_message_id; return c })
        ;({ error: insErr } = await supabase.from('nodes').insert(stripped))
      }
      if (insErr) { console.error('update: insert failed', insErr); throw new Error('db') }

      // Keep the localStorage provenance fallback in sync so these freshly
      // pulled nodes also keep their source logo across a refresh.
      rememberImportedProvenance(convId, readImportedSource(convId) || 'claude', ordered.map((r) => r.id))

      // Best-effort sync metadata (ignored if columns absent).
      try {
        await supabase.from('projects')
          .update({ source_synced_at: new Date().toISOString(), source_leaf_id: tree.currentLeaf ?? null })
          .eq('id', convId)
      } catch {}

      // Re-render if it's the on-screen conversation, landing on the new leaf.
      if (activeConvIdRef.current === convId) {
        const newLeaf = tree.currentLeaf ? sourceToNodea.get(tree.currentLeaf) : null
        if (newLeaf) { try { localStorage.setItem(`lastNodeId_${convId}`, newLeaf) } catch {} }
        const nm = conversations.find((c) => c.id === convId)?.name || convName
        await loadConversation(convId, nm)
      }
      return { status: 'ok', added: newOnes.length }
    },
    [supabase, loadConversation, conversations, convName],
  )

  const updateFromSource = useCallback(async () => {
    const convId = activeConvIdRef.current
    if (!convId || isUpdatingSource) return
    const { data: proj, error } = await supabase
      .from('projects').select('source, source_conversation_id, source_org_id').eq('id', convId).maybeSingle()
    if (error || !proj?.source || !proj?.source_conversation_id) {
      showImportNotice('This conversation isn’t linked to a source to update from.', 'error', 5000)
      return
    }
    setIsUpdatingSource(true)
    try {
      // If the bridge never announced itself, fail fast with an install hint;
      // if it did, give Claude the full window (SW fetch + possible tab fallback).
      const res = await requestSourceTree(
        proj.source_conversation_id as string, (proj.source_org_id as string) || null, proj.source as string,
        extPresentRef.current ? 15000 : 4000,
      )
      if (!res.ok) {
        const notDetected = !extPresentRef.current && res.error === 'timeout'
        showImportNotice(
          notDetected
            ? 'Nodea extension not detected. Install it and reload this page, then try Update again.'
            : res.error === 'timeout'
              ? 'Couldn’t reach Claude. Make sure you’re signed into claude.ai, then try again.'
              : `Update failed: ${res.error}`,
          'error', 7000,
        )
        return
      }
      const applied = await applySourceTree(convId, res.tree)
      if (applied.status === 'unlinked') {
        showImportNotice('This conversation predates sync. Re-import it from the extension to enable updates.', 'error', 7000)
      } else if (applied.added > 0) {
        showImportNotice(`Updated from Claude: ${applied.added} new node${applied.added === 1 ? '' : 's'} added ✓`, 'info', 5000)
        try { track('conversation_synced', { source: proj.source, added: applied.added }) } catch {}
      } else {
        showImportNotice('Already up to date with Claude ✓', 'info', 4000)
      }
    } catch (e) {
      console.error('update failed', e)
      showImportNotice('Update failed. See the console for details.', 'error', 6000)
    } finally {
      setIsUpdatingSource(false)
    }
  }, [supabase, isUpdatingSource, requestSourceTree, applySourceTree, showImportNotice])

  // Delete the active conv only if it's truly empty: no DB nodes, no in-flight
  // local messages, and no send in progress. The local-messages check matters
  // because a mid-stream user message lives in `messages` before it's persisted
  // to `nodes` — without this guard, clicking "New Conversation" mid-send would
  // delete the conv that the running save is about to write into, producing
  // the "Message sent but could not be saved to history" error.
  const deleteIfEmpty = useCallback((): string | null => {
    if (!activeConvId || !isCurrentLoaded) return null
    // Never delete a conversation that's still generating a reply: it may have
    // just been backgrounded by this very switch, and its response is on the way.
    if (inFlightRef.current.has(activeConvId)) return null
    if (allDbNodes.length > 0) return null
    if (messages.length > 0) return null
    const oldId = activeConvId
    const oldConv = conversations.find((c) => c.id === oldId)
    setConversations((prev) => prev.filter((c) => c.id !== oldId))
    // Keep the in-memory project chat_count honest. It's recomputed from real
    // rows on the next load, but if we reap a conv mid-session without
    // decrementing, the project shows a phantom chat ("2 chats, nothing there").
    if (oldConv?.chat_project_id) {
      setChatProjects((prev) => prev.map((p) =>
        p.id === oldConv.chat_project_id ? { ...p, chat_count: Math.max(0, p.chat_count - 1) } : p,
      ))
    }
    supabase.from('projects').delete().eq('id', oldId).then(({ error }) => {
      if (error) console.error('Auto-delete empty conv failed', error)
    })
    return oldId
  }, [activeConvId, isCurrentLoaded, allDbNodes, messages, conversations, supabase])

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Launched from the extension's "Open in Nodea"? The user may be signed
        // in there but not on this site — adopt the extension's session (login
        // carry-over) before bouncing to /login. See adoptExtensionSession.
        const extHandoff = new URLSearchParams(window.location.search).has('import')
        if (extHandoff && (await adoptExtensionSession())) {
          ;({ data: { user } } = await supabase.auth.getUser())
        }
      }
      if (!user) { router.push('/login'); return }
      const displayName = user.user_metadata?.display_name
      if (typeof displayName !== 'string' || displayName.trim().length === 0) {
        router.push('/welcome')
        return
      }
      setUserEmail(user.email ?? '')
      setUserName(displayName)
      setAuthedReady(true)

      const hardcodedAdmin = user.id === '64b415d7-4b59-4ff1-aa35-5f88de1599de'
      setIsAdmin(hardcodedAdmin)
      if (hardcodedAdmin) {
        setIsPro(true)
      } else {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('is_admin, plan')
          .eq('user_id', user.id)
          .maybeSingle()
        const dbAdmin = profile?.is_admin === true
        if (dbAdmin) setIsAdmin(true)
        setIsPro(dbAdmin || profile?.plan === 'pro')
      }

      const res = await fetch('/api/projects')
      if (!res.ok) { router.push('/login'); return }
      const { projects } = await res.json()
      if (!projects?.length) {
        setConvName('')
        return
      }

      const normalized: Conversation[] = (projects as Conversation[]).map((p) => ({
        ...p,
        chat_project_id: p.chat_project_id ?? null,
        // The DB may not have the `source` column yet; restore it from the
        // localStorage provenance fallback so the imported-source logo (which
        // reads activeConvSource) survives a refresh.
        source: p.source ?? readImportedSource(p.id),
      }))
      setConversations(normalized)
      const lastId = localStorage.getItem('lastConvId')
      const initial = normalized.find((p) => p.id === lastId) ?? normalized[0]
      await loadConversation(initial.id, initial.name)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load chat projects (Pro feature; gracefully tolerant for free users) ──
  // The list endpoint is open to everyone (so an existing free user with
  // projects from a former Pro plan still sees them, read-only). Mutations
  // are gated server-side.
  const reloadChatProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/chat-projects')
      if (!res.ok) return
      const { projects } = await res.json() as { projects: ChatProject[] }
      setChatProjects(projects ?? [])
    } catch {
      // The DB migration may not have run yet — ignore.
    }
  }, [])

  useEffect(() => {
    reloadChatProjects()
  }, [reloadChatProjects])

  // ── Project + view helpers ────────────────────────────────────────────────
  const openProjectsLanding = useCallback(() => {
    if (!isPro) {
      setIsUpgradeOpen(true)
      track('upgrade_clicked', { source: 'sidebar_projects' })
      return
    }
    setActiveChatProjectId(null)
    setView('projects')
  }, [isPro])

  const openProject = useCallback((id: string) => {
    setActiveChatProjectId(id)
    setView('project')
  }, [])

  const openChatView = useCallback((convId?: string) => {
    if (convId) setActiveConvId(convId)
    setView('chat')
  }, [])

  const openNewProjectModal = useCallback(() => {
    if (!isPro) {
      setIsUpgradeOpen(true)
      return
    }
    setProjectModalState({ mode: 'create' })
  }, [isPro])

  const openConvContext = useCallback((conv: Conversation, x: number, y: number) => {
    setProjectMenu(null)
    setConvMenu({ conv, x, y })
  }, [])

  const openProjectContext = useCallback((project: ChatProject, x: number, y: number) => {
    setConvMenu(null)
    setProjectMenu({ project, x, y })
  }, [])

  // ── Save / update project (create or edit) ─────────────────────────────────
  const saveProject = useCallback(async (data: ChatProjectInput) => {
    if (!projectModalState) return
    if (projectModalState.mode === 'create') {
      const res = await fetch('/api/chat-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.status === 403) {
        setProjectModalState(null)
        setIsUpgradeOpen(true)
        return
      }
      if (!res.ok) {
        console.error('[saveProject] create failed', res.status)
        return
      }
      const { project } = await res.json() as { project: ChatProject }
      setChatProjects((prev) => [...prev, project])
      setProjectModalState(null)
      track('chat_project_created')
      trackEvent('chat_project_created')
    } else {
      const target = projectModalState.project
      const res = await fetch(`/api/chat-projects/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        console.error('[saveProject] update failed', res.status)
        return
      }
      const { project } = await res.json() as { project: ChatProject }
      setChatProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, ...project } : p)))
      setProjectModalState(null)
    }
  }, [projectModalState])

  // ── Save a project's memory box (inline edit on the project page) ───────────
  // Resolves on success and throws on failure so the box can keep edit mode
  // open and surface that it didn't save. 403 means the plan no longer allows
  // editing — open the upgrade flow before bubbling the error up.
  const saveProjectMemory = useCallback(async (projectId: string, memory: string) => {
    const res = await fetch(`/api/chat-projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory }),
    })
    if (res.status === 403) {
      setIsUpgradeOpen(true)
      throw new Error('pro_required')
    }
    if (!res.ok) {
      console.error('[saveProjectMemory] failed', res.status)
      throw new Error('save_failed')
    }
    const { project } = await res.json() as { project: ChatProject }
    setChatProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, ...project } : p)))
  }, [])

  // ── Delete project ─────────────────────────────────────────────────────────
  const confirmDeleteProject = useCallback(async (deleteConvs: boolean) => {
    if (!deleteProjectState) return
    const pid = deleteProjectState.id
    const res = await fetch(
      `/api/chat-projects/${pid}?deleteConversations=${deleteConvs ? '1' : '0'}`,
      { method: 'DELETE' },
    )
    if (!res.ok) {
      console.error('[deleteProject]', res.status)
      return
    }
    setChatProjects((prev) => prev.filter((p) => p.id !== pid))
    if (deleteConvs) {
      // Drop the affected conversations from the in-memory list too.
      setConversations((prev) => prev.filter((c) => c.chat_project_id !== pid))
      // If the user was viewing one of them, switch to whatever's left.
      const stillExists = conversations.some((c) => c.id === activeConvId && c.chat_project_id !== pid)
      if (!stillExists) {
        const fallback = conversations.find((c) => c.chat_project_id !== pid)
        if (fallback) {
          await loadConversation(fallback.id, fallback.name)
        } else {
          setActiveConvId(null)
          setMessages([])
          setAllDbNodes([])
        }
      }
    } else {
      // Keep conversations, just unparent them in the in-memory list.
      setConversations((prev) => prev.map((c) =>
        c.chat_project_id === pid ? { ...c, chat_project_id: null } : c,
      ))
    }
    if (activeChatProjectId === pid) {
      setActiveChatProjectId(null)
      setView('projects')
    }
    setDeleteProjectState(null)
    track('chat_project_deleted')
  }, [deleteProjectState, conversations, activeConvId, activeChatProjectId, loadConversation])

  // ── Assign / detach a conversation to/from a project ───────────────────────
  const assignConvToProject = useCallback(async (convId: string, projectId: string | null) => {
    // Optimistic update
    setConversations((prev) => prev.map((c) =>
      c.id === convId ? { ...c, chat_project_id: projectId } : c,
    ))
    // Bump the chat_count locally so pinned-project rows feel instant.
    setChatProjects((prev) => prev.map((p) => {
      const prevConv = conversations.find((c) => c.id === convId)
      let delta = 0
      if (prevConv?.chat_project_id === p.id) delta -= 1
      if (projectId === p.id) delta += 1
      if (delta === 0) return p
      return { ...p, chat_count: Math.max(0, p.chat_count + delta) }
    }))

    const res = await fetch(`/api/conversations/${convId}/project`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_project_id: projectId }),
    })
    if (res.status === 403) {
      // Revert optimistic change on Pro-gate failure.
      await reloadChatProjects()
      // Reload the affected conversation row too.
      const prevConv = conversations.find((c) => c.id === convId)
      if (prevConv) {
        setConversations((prev) => prev.map((c) =>
          c.id === convId ? { ...c, chat_project_id: prevConv.chat_project_id ?? null } : c,
        ))
      }
      setIsUpgradeOpen(true)
      return
    }
    if (!res.ok) {
      console.error('[assignConvToProject]', res.status)
      await reloadChatProjects()
    }
  }, [conversations, reloadChatProjects])

  // ── New chat inside a project: create then assign in one shot ──────────────
  const requestNewChatInProject = useCallback(async (projectId: string, initialMessage?: string) => {
    if (!isPro) { setIsUpgradeOpen(true); return }
    const seed = initialMessage?.trim()
    // Create the conversation through the existing route.
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Conversation' }),
    })
    if (!res.ok) return
    const { project } = await res.json() as { project: Conversation }
    const newConv: Conversation = { ...project, chat_project_id: projectId }
    deleteIfEmpty()
    setConversations((prev) => [...prev, newConv])
    // Tag the new conversation with the project.
    await fetch(`/api/conversations/${newConv.id}/project`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_project_id: projectId }),
    }).catch(() => {})
    // Bump chat_count on the in-memory project.
    setChatProjects((prev) => prev.map((p) =>
      p.id === projectId ? { ...p, chat_count: p.chat_count + 1 } : p,
    ))
    // Stash before loading so the delivery effect sees it the moment the new
    // conversation finishes loading into the chat view.
    pendingProjectMsgRef.current = seed && seed.length > 0 ? seed : null
    setView('chat')
    await loadConversation(newConv.id, newConv.name)
    track('conversation_created', { in_project: true })
    trackEvent('conversation_created', { in_project: true })
  }, [isPro, deleteIfEmpty, loadConversation])

  // ── Toggle pin on a project ────────────────────────────────────────────────
  const toggleProjectPin = useCallback(async (projectId: string) => {
    const target = chatProjects.find((p) => p.id === projectId)
    if (!target) return
    // Enforce the cap client-side too so we don't even fire the request.
    if (!target.pinned) {
      const pinnedCount = chatProjects.filter((p) => p.pinned).length
      if (pinnedCount >= MAX_PINNED_PROJECTS) {
        // Silently no-op for now — the UI surface for this lives on the
        // landing page where the user has context for the cap.
        return
      }
    }
    setChatProjects((prev) => prev.map((p) =>
      p.id === projectId ? { ...p, pinned: !p.pinned } : p,
    ))
    await fetch(`/api/chat-projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !target.pinned }),
    }).catch(() => {})
  }, [chatProjects])

  // ── Save an edit-conversation modal (name + project assignment) ────────────
  // We call Supabase directly for the rename rather than going through
  // renameConversation (which is declared later in this file and would create
  // a temporal dead-zone reference inside this useCallback).
  const saveConvEdit = useCallback(async (
    convId: string,
    changes: { name: string; chat_project_id: string | null },
  ) => {
    const conv = conversations.find((c) => c.id === convId)
    if (!conv) return

    const trimmed = changes.name.trim()
    if (trimmed && trimmed !== conv.name) {
      const { error } = await supabase
        .from('projects')
        .update({ name: trimmed })
        .eq('id', convId)
      if (!error) {
        setConversations((prev) => prev.map((c) =>
          c.id === convId ? { ...c, name: trimmed } : c,
        ))
        if (convId === activeConvId) setConvName(trimmed)
      }
    }

    if (changes.chat_project_id !== (conv.chat_project_id ?? null)) {
      await assignConvToProject(convId, changes.chat_project_id)
    }
    setEditConvState(null)
  }, [conversations, supabase, activeConvId, assignConvToProject])

  // ── Cmd/Ctrl+K — open search (Task 2) ────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (chatInputRef.current && document.activeElement === chatInputRef.current) return
        e.preventDefault()
        trackEvent('search_opened', { trigger: 'keyboard' })
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch conversation ───────────────────────────────────────────────────
  const switchConversation = useCallback(
    async (id: string) => {
      const conv = conversations.find((c) => c.id === id)
      if (!conv) return
      if (id === activeConvId) return
      deleteIfEmpty()
      await loadConversation(id, conv.name)
    },
    [conversations, activeConvId, deleteIfEmpty, loadConversation]
  )

  // ── Create new conversation ───────────────────────────────────────────────
  const createConversation = useCallback(async () => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Conversation' }),
    })
    if (!res.ok) return
    const { project } = await res.json()
    deleteIfEmpty()
    const newConv: Conversation = { ...project, chat_project_id: project.chat_project_id ?? null }
    setConversations((prev) => [...prev, newConv])
    await loadConversation(newConv.id, newConv.name)
    track('conversation_created')
    trackEvent('conversation_created')
  }, [deleteIfEmpty, loadConversation])

  // ── Rename conversation (Task 3) ──────────────────────────────────────────
  const renameConversation = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const { error } = await supabase.from('projects').update({ name: trimmed }).eq('id', id)
    if (error) { console.error('Rename failed', error); return }
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, name: trimmed } : c))
    if (id === activeConvId) setConvName(trimmed)
  }, [supabase, activeConvId])

  // ── Set conversation color ────────────────────────────────────────────────
  const setConvColor = useCallback(async (id: string, color: string | null) => {
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, color } : c))
    const { error } = await supabase.from('projects').update({ color }).eq('id', id)
    if (error) console.error('Set color failed', error)
    else track('conversation_color_changed', { color: color ?? 'none' })
  }, [supabase])

  // ── Delete conversation (Task 4) ──────────────────────────────────────────
  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from('nodes').delete().eq('project_id', id)
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { console.error('Delete failed', error); return }

    track('conversation_deleted')
    // Drop any pending node-undo entries for this conversation — its rows are
    // gone for good, so Ctrl+Z must not try to restore them into a dead project.
    undoStackRef.current = undoStackRef.current.filter((e) => e.convId !== id)
    setUndoToast((t) => (t && !undoStackRef.current.some((e) => e.id === t.id) ? null : t))
    const remaining = conversations.filter((c) => c.id !== id)
    setConversations(remaining)

    if (id === activeConvId) {
      if (remaining.length > 0) {
        await loadConversation(remaining[0].id, remaining[0].name)
      } else {
        setActiveConvId(null)
        setConvName('')
        setMessages([])
        setAllDbNodes([])
        setSelectedNodeId(null)
        setNodeColors({})
        lastNodeIdRef.current = null
      }
    }
  }, [supabase, activeConvId, conversations, loadConversation])

  // ── Save the user's message immediately ───────────────────────────────────
  // Persist the user node the moment the message is sent — BEFORE the model
  // call — so the conversation has real content and survives a switch-away even
  // if the reply is slow, errors out, or the user navigates elsewhere. The
  // assistant node is appended later by saveAssistantNode. Pinned to its origin
  // conversation (pid); live view is only touched while that conv is on screen.
  const saveUserNode = useCallback(
    async (
      pid: string,
      parentId: string | null,
      userContent: string,
      attachments?: AttachmentItem[],
      mergeSources?: string[],
    ): Promise<DbNode | null> => {
      if (!pid) return null

      const attachmentMeta: NodeAttachment[] =
        attachments?.map((a) => ({ name: a.name, type: a.type, url: a.dataUrl })) ?? []

      // Embed attachment URLs in the content itself so they roundtrip through
      // the DB without needing a schema migration — and so when the user forks
      // a branch from this node, the next request still has the image URLs.
      const persistedContent = serializeUserContent(userContent, attachmentMeta)

      const hasMerges = !!(mergeSources && mergeSources.length > 0)
      const baseRow = { project_id: pid, parent_id: parentId, role: 'user' as const, content: persistedContent, position_x: 0, position_y: 0 }
      const isColumnError = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204'
      let mergeDropped = false

      // Try the richest row first (attachments + merge links), then peel off the
      // newest optional columns if the schema doesn't have them yet. The two
      // codes that show up here are Postgres-native 42703 (column truly missing)
      // and PostgREST's PGRST204 ("schema cache" — column exists but the API
      // layer hasn't refreshed). Attachment metadata also lives in the content
      // header, so dropping it is lossless; dropping merge links just means the
      // merge can't persist until the migration is pushed.
      let { data: userNode, error: ue } = await supabase
        .from('nodes')
        .insert(hasMerges ? { ...baseRow, attachments: attachmentMeta, merge_sources: mergeSources } : { ...baseRow, attachments: attachmentMeta })
        .select()
        .single()
      if (isColumnError(ue) && hasMerges) {
        mergeDropped = true
        ;({ data: userNode, error: ue } = await supabase
          .from('nodes')
          .insert({ ...baseRow, attachments: attachmentMeta })
          .select()
          .single())
      }
      if (isColumnError(ue)) {
        ;({ data: userNode, error: ue } = await supabase
          .from('nodes')
          .insert(baseRow)
          .select()
          .single())
      }
      if (!ue && mergeDropped) notifyMergeUnavailable()
      if (ue || !userNode) {
        console.error('user node save failed', ue)
        if (activeConvIdRef.current === pid) setSaveError(true)
        return null
      }

      // The user node is now this conversation's branch tip — persist it so a
      // return restores the right path even before any reply lands. Also record
      // it as the most-recent branch at its parent fork, so returning here later
      // follows this new branch rather than an older sibling.
      localStorage.setItem(`lastNodeId_${pid}`, userNode.id)
      if (parentId) {
        // Mutate the live map only when this is the on-screen conv; otherwise
        // update the backgrounded conv's persisted choices without touching it.
        if (activeConvIdRef.current === pid) {
          branchChoiceRef.current.set(parentId, userNode.id)
          persistBranchChoices(pid, branchChoiceRef.current)
        } else {
          const choices = loadBranchChoices(pid)
          choices.set(parentId, userNode.id)
          persistBranchChoices(pid, choices)
        }
      }
      if (activeConvIdRef.current === pid) {
        lastNodeIdRef.current = userNode.id
        const userNodeWithAtt: DbNode = { ...(userNode as DbNode), attachments: attachmentMeta }
        setAllDbNodes((prev) => [...prev, userNodeWithAtt])
      }
      return userNode as DbNode
    },
    [supabase, notifyMergeUnavailable]
  )

  // ── Save the assistant's reply ────────────────────────────────────────────
  // Appended once the stream completes, as a child of the already-persisted
  // user node. Pinned to its origin conversation (pid) so a backgrounded reply
  // still lands in the right place; live view is only touched while that conv
  // is on screen.
  const saveAssistantNode = useCallback(
    async (
      pid: string,
      userNodeId: string,
      assistantContent: string,
      modelId?: string,
    ): Promise<string | null> => {
      if (!pid || !userNodeId) return null

      const baseRow = { project_id: pid, parent_id: userNodeId, role: 'assistant', content: assistantContent, position_x: 0, position_y: 0 }
      // Stamp the model so the "Claude · {model}" label + logo survive a refresh.
      // Graceful-degrade exactly like attachments / merge_sources / provenance:
      // if the model_id column isn't migrated yet, retry the insert without it.
      const isColumnError = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204'
      let { data: asst, error: ae } = await supabase
        .from('nodes')
        .insert(modelId ? { ...baseRow, model_id: modelId } : baseRow)
        .select()
        .single()
      if (ae && modelId && isColumnError(ae)) {
        ;({ data: asst, error: ae } = await supabase
          .from('nodes')
          .insert(baseRow)
          .select()
          .single())
      }
      if (ae || !asst) {
        console.error('assistant node save failed', ae)
        if (activeConvIdRef.current === pid) setSaveError(true)
        return null
      }

      localStorage.setItem(`lastNodeId_${pid}`, asst.id)
      if (activeConvIdRef.current === pid) {
        lastNodeIdRef.current = asst.id
        setSelectedNodeId(asst.id)
        setLastSavedPairId(asst.id)
        setAllDbNodes((prev) => [...prev, asst as DbNode])
      }
      return asst.id
    },
    [supabase]
  )

  // ── Shared generation core ────────────────────────────────────────────────
  // The fetch → stream → persist tail shared by a normal send (handleSend) and
  // an edited prompt (editUserMessage). The caller owns the optimistic UI
  // (appending the user bubble, clearing the composer, marking in-flight); this
  // owns the upload, the model call, the typewriter paint, saving the assistant
  // node, and the fire-and-forget follow-ups. Pinned to `targetConvId` so a
  // reply that lands after the user navigates away still saves to the right place.
  const generateReply = useCallback(
    async (p: {
      targetConvId: string | null
      parentId: string | null
      userContent: string
      attachments: AttachmentItem[] | undefined
      nextMessages: ChatMessage[]
      userMsgId: string
      assistantId: string
      autoTitleConversation: boolean
      /** Merge links to persist on the new user node (Flow-A merged prompt). */
      mergeSources?: string[]
    }) => {
      const { targetConvId, parentId, userContent, nextMessages, userMsgId, assistantId } = p

      // The snapshot we'll actually send and persist. Starts as the caller's
      // snapshot (possibly data: URLs), then upgrades to Storage URLs on upload.
      let attachmentsSnapshot = p.attachments
      // Set once the user message is persisted (before the model call); the
      // assistant reply is then saved as this node's child after the stream.
      let savedUserNodeId: string | null = null

      try {
        // Upload any newly-attached files (data: URLs) to Supabase Storage so
        // (1) the chat API request stays well under the 4.5 MB serverless cap,
        // and (2) the URL persists across branches without bloating the DB.
        if (attachmentsSnapshot?.some((a) => a.dataUrl.startsWith('data:'))) {
          const uploaded = await Promise.all(
            attachmentsSnapshot.map(async (a) => {
              if (!a.dataUrl.startsWith('data:')) return a  // already a URL
              const r = await fetch('/api/upload-attachment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: a.name, type: a.type, dataUrl: a.dataUrl }),
              })
              if (!r.ok) throw new Error('Attachment upload failed')
              const { url } = await r.json() as { url: string }
              return { ...a, dataUrl: url }
            })
          )
          attachmentsSnapshot = uploaded
          // Reflect the URL-backed attachments in the on-screen message too,
          // so subsequent renders don't keep huge base64 blobs in memory.
          setMessages((prev) => prev.map((m) =>
            m.id === userMsgId ? { ...m, attachments: uploaded } : m
          ))
        }

        // Persist the user's message NOW — before the model call — so the
        // conversation has content and won't be auto-deleted if the reply is
        // slow, errors out, or the user switches away before it lands.
        if (targetConvId) {
          const savedUser = await saveUserNode(targetConvId, parentId, userContent, attachmentsSnapshot, p.mergeSources)
          savedUserNodeId = savedUser?.id ?? null
        }

        // Send messages with the post-upload attachments (URLs, not data:).
        const messagesForApi = nextMessages.map((m) =>
          m.id === userMsgId ? { ...m, attachments: attachmentsSnapshot } : m
        )
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messagesForApi, conversationId: targetConvId }),
        })
        if (response.status === 429) {
          const data = await response.json().catch(() => ({}))
          track('token_limit_hit', { limit_type: data.limit_type ?? 'unknown' })
          throw new RateLimitError(formatRateLimitMessage(data, isPro), data.limit_type ?? 'unknown')
        }
        if (!response.ok) throw new Error('Chat request failed')

        const modelId = response.headers.get('X-Model-Id') ?? undefined

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), modelId },
        ])

        const reader  = response.body?.getReader()
        const decoder = new TextDecoder()
        let full      = ''
        if (reader) {
          // Decouple network chunk arrivals from render rate. Tokens land in
          // bursts and re-parsing markdown on every chunk visibly lags long
          // answers. A rAF loop coalesces bursts into one paint per frame and
          // reveals chars progressively for a typewriter feel.
          let displayedLen = 0
          let streamDone   = false
          let cancelled    = false

          const paint = () => {
            if (cancelled) return
            if (displayedLen < full.length) {
              const gap  = full.length - displayedLen
              // Catch up fast when far behind, slow when close. Last few chars
              // always reveal over a couple frames so the finish reads smoothly.
              const step = Math.max(2, Math.ceil(gap / 6))
              displayedLen = Math.min(full.length, displayedLen + step)
              const visible = full.slice(0, displayedLen)
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantId)
                if (idx < 0) { cancelled = true; return prev }
                const updated = [...prev]
                updated[idx] = { ...updated[idx], content: visible, modelId }
                return updated
              })
            }
            if (!cancelled && (!streamDone || displayedLen < full.length)) {
              requestAnimationFrame(paint)
            }
          }
          requestAnimationFrame(paint)

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            full += decoder.decode(value, { stream: true })
          }
          streamDone = true
        }
        if (full.trim() && targetConvId && savedUserNodeId) {
          const isFirstPair = parentId === null
          const newPairId = await saveAssistantNode(targetConvId, savedUserNodeId, full, modelId)

          // Reconcile the optimistic user-message id to its real node id, so the
          // prompt can be edited / version-navigated without waiting for a
          // reload. (The assistant keeps its local id — the memory badge below
          // keys off it.) Only touches the live view when still on this conv.
          if (activeConvIdRef.current === targetConvId) {
            const realUserId = savedUserNodeId
            setMessages((prev) => prev.map((m) => (m.id === userMsgId ? { ...m, id: realUserId } : m)))
          }

          // Fire-and-forget: cross-chat memory extraction (Pro only, server-gated).
          // The route returns {saved: []} for free users so we never need to
          // branch on plan here.
          if (isPro) {
            fetch('/api/memory/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userMessage: userContent, assistantReply: full }),
            }).then((r) => r.ok ? r.json() : null).then((data) => {
              const saved = (data?.saved ?? []) as string[]
              if (saved.length === 0) return
              // The badge keys off a session message id, so only apply it while
              // that conversation is still on screen.
              if (activeConvIdRef.current === targetConvId) {
                setMemorySavedByMsgId((prev) => ({ ...prev, [assistantId]: saved }))
              }
            }).catch(() => {})
          }

          // Fire-and-forget: generate AI title + summary for the node
          if (newPairId) {
            fetch('/api/autotitle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userPrompt: userContent, aiResponse: full, type: 'node' }),
            }).then(r => r.ok ? r.json() : null).then(data => {
              if (!data) return
              const meta = { title: data.title ?? '', summary: data.summary ?? '' }
              // Persist regardless (keyed by node id, restored on reload); only
              // touch live state if its conversation is still showing.
              localStorage.setItem(`node_meta_v1_${newPairId}`, JSON.stringify(meta))
              if (activeConvIdRef.current === targetConvId) {
                setNodeSummaries(prev => ({ ...prev, [newPairId]: meta }))
              }
            }).catch(() => {})
          }

          // Fire-and-forget: auto-title the conversation on its first message
          // (a normal send only — editing an existing prompt leaves the title).
          if (isFirstPair && p.autoTitleConversation) {
            fetch('/api/autotitle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userPrompt: userContent, type: 'conversation' }),
            }).then(r => r.ok ? r.json() : null).then(data => {
              if (data?.title) renameConversation(targetConvId, data.title)
            }).catch(() => {})
          }
        }
      } catch (err) {
        console.error('Chat error', err)
        // The user's message is already persisted (saveUserNode, above), so keep
        // it on screen and in the conversation — only drop the empty assistant
        // bubble we optimistically added. The conversation stays put.
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
        // Only surface the upgrade modal for free users who exhausted the daily
        // pool — Pro users and per-message size caps don't get fixed by upgrading.
        if (err instanceof RateLimitError && !isPro && err.limitType === 'daily') {
          setIsUpgradeOpen(true)
        } else if (activeConvIdRef.current === targetConvId) {
          // Surface the error inline. We no longer restore the prompt to the
          // composer because the message itself is already saved — the user can
          // see it in the thread and retry from there.
          setChatError(
            err instanceof Error
              ? err.message
              : 'Failed to get a response. Check your connection and try again.',
          )
        }
      } finally {
        if (targetConvId) clearInFlight(targetConvId)
      }
    },
    [saveUserNode, saveAssistantNode, isPro, clearInFlight, renameConversation],
  )

  // ── Send a message ────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      // A programmatic send (project "start a new chat") passes its prompt via
      // forcedSendRef, set synchronously just before requestSubmit(). Consume it
      // here so we don't read a not-yet-committed `input`. Normal sends leave it
      // null and fall back to the live input value.
      const forced = forcedSendRef.current
      forcedSendRef.current = null
      const resolvedInput = forced ?? input
      const hasText = resolvedInput.trim().length > 0
      const hasAttachments = pendingAttachments.length > 0
      if ((!hasText && !hasAttachments) || isLoading) return

      // Pin this send to the conversation (and branch parent) it started in.
      // If the user switches away before the reply lands, it still saves here
      // instead of following whatever conversation becomes active.
      const targetConvId = activeConvId
      const parentId     = lastNodeIdRef.current

      setChatError(null)
      setSaveError(false)
      setHighlightedMessageId(null)

      const userContent             = resolvedInput.trim()
      const localAttachmentsSnapshot = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined
      const now                      = Date.now()
      const userMsg: ChatMessage = {
        id: now.toString(), role: 'user', content: userContent,
        timestamp: now, attachments: localAttachmentsSnapshot,
      }
      const assistantId = (now + 1).toString()

      // The visible chat thread stays the plain active path. If this send's
      // lineage involves a merge, the MODEL gets a richer joined transcript via
      // apiMessages, without reshuffling what the user sees in the chat panel.
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setPendingAttachments([])
      if (targetConvId) markInFlight(targetConvId)

      // Merge context: an armed Flow-A merge for this exact branch tip, or any
      // node on the active path carrying merge_sources (a Flow-B follow-up).
      const pendingMerge = pendingMergeRef.current && pendingMergeRef.current.parentId === parentId
        ? pendingMergeRef.current.mergeSources
        : null
      pendingMergeRef.current = null
      const pathHasMerges = parentId
        ? ancestorChain(parentId, new Map(allDbNodes.map((n) => [n.id, n]))).some((n) => n.merge_sources && n.merge_sources.length > 0)
        : false
      const mergeSourcesForSend = pendingMerge && pendingMerge.length > 0 ? pendingMerge : undefined
      const apiMessages = (mergeSourcesForSend || pathHasMerges)
        ? buildMergedContext(allDbNodes, parentId, mergeSourcesForSend ?? [], userMsg)
        : nextMessages

      track('message_sent', {
        has_attachment: pendingAttachments.length > 0,
        attachment_count: pendingAttachments.length,
        conversation_length: messages.length,
      })
      trackEvent('message_sent', {
        has_attachment: pendingAttachments.length > 0,
        conversation_length: messages.length,
      })
      if (isBranchPointRef.current) {
        track('branch_created')
        trackEvent('branch_created')
        isBranchPointRef.current = false
      }

      // Hand off to the shared generation core: it owns the upload, the model
      // call, the typewriter paint, persisting the assistant reply, and the
      // fire-and-forget follow-ups. A normal send auto-titles a brand-new
      // conversation on its first message.
      await generateReply({
        targetConvId,
        parentId,
        userContent,
        attachments: localAttachmentsSnapshot,
        nextMessages: apiMessages,
        userMsgId: userMsg.id,
        assistantId,
        autoTitleConversation: true,
        mergeSources: mergeSourcesForSend,
      })
    },
    [input, isLoading, messages, pendingAttachments, activeConvId, allDbNodes, markInFlight, generateReply, setInput],
  )

  // ── Edit a prior prompt (Claude/GPT-style) ────────────────────────────────
  // Editing a user message doesn't overwrite it — in a branching canvas it
  // forks a NEW version from the SAME parent, regenerates the reply, and makes
  // that branch the active path. The original prompt and its replies stay in
  // the tree, reachable via the version arrows (‹ n/m ›) or the tree panel.
  const editUserMessage = useCallback(
    async (userNodeId: string, newText: string) => {
      if (!activeConvId) return
      const trimmed = newText.trim()
      const orig = allDbNodes.find((n) => n.id === userNodeId && n.role === 'user')
      if (!orig) return

      const { text: origText, attachments: origAtts } = parseUserContent(orig.content)
      // Unchanged (or empty) text → no-op, so we don't spawn a duplicate branch.
      if (!trimmed || trimmed === origText.trim()) return

      const parentId = orig.parent_id

      // Rebuild the context prefix: the path from the root down to the edited
      // prompt's parent (inclusive). Everything below the edit is replaced by
      // the new branch we're about to grow.
      const nodeMap = new Map(allDbNodes.map((n) => [n.id, n]))
      const prefix: DbNode[] = []
      let cur: DbNode | undefined = parentId ? nodeMap.get(parentId) : undefined
      while (cur) {
        prefix.unshift(cur)
        cur = cur.parent_id ? nodeMap.get(cur.parent_id) : undefined
      }
      const prefixMessages = prefix.map(dbNodeToMessage)

      // Carry the original prompt's attachments onto the edited version. They're
      // already Storage URLs, so generateReply's upload step passes them through.
      const attachmentItems: AttachmentItem[] | undefined = origAtts.length > 0
        ? origAtts.map((a) => ({ name: a.name, type: a.type, dataUrl: a.url ?? '' }))
        : undefined

      setChatError(null)
      setSaveError(false)
      setHighlightedMessageId(null)

      const now = Date.now()
      const userMsg: ChatMessage = {
        id: now.toString(), role: 'user', content: trimmed,
        timestamp: now, attachments: attachmentItems,
      }
      const assistantId = (now + 1).toString()
      const nextMessages = [...prefixMessages, userMsg]
      setMessages(nextMessages)

      // Branch from the edited prompt's parent; clear any stale branch-point
      // flag so the next normal send isn't mis-tagged.
      lastNodeIdRef.current = parentId
      isBranchPointRef.current = false
      markInFlight(activeConvId)

      track('prompt_edited')
      track('branch_created')
      trackEvent('prompt_edited')
      trackEvent('branch_created')

      await generateReply({
        targetConvId: activeConvId,
        parentId,
        userContent: trimmed,
        attachments: attachmentItems,
        nextMessages,
        userMsgId: userMsg.id,
        assistantId,
        autoTitleConversation: false,
      })
    },
    [activeConvId, allDbNodes, markInFlight, generateReply],
  )

  // ── Deliver a project's "start a new chat" prompt ─────────────────────────
  // requestNewChatInProject stashes the typed prompt in pendingProjectMsgRef.
  // Once the freshly created conversation has loaded into the chat view, drop
  // it into the composer and submit — otherwise the prompt is lost and the
  // empty conversation gets auto-deleted by deleteIfEmpty on the next nav.
  useEffect(() => {
    const pending = pendingProjectMsgRef.current
    if (!pending) return
    if (view !== 'chat' || !isCurrentLoaded || isLoading) return
    pendingProjectMsgRef.current = null
    // Show the prompt in the composer as a fallback: if the form isn't mounted
    // yet and the programmatic submit can't fire, the text stays put so the
    // user can send it manually rather than losing it.
    setInput(pending)
    requestAnimationFrame(() => {
      const form = chatInputRef.current?.form
      if (!form) return
      // Set synchronously right before submit so handleSend reads it directly
      // (see forcedSendRef) instead of the still-async `input` state.
      forcedSendRef.current = pending
      form.requestSubmit()
    })
  }, [view, isCurrentLoaded, isLoading, activeConvId, setInput])

  // ── Click a tree node ─────────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (!activeConvId) return
      // Navigating cancels any armed merge (beginMerge re-arms it after this call).
      pendingMergeRef.current = null
      const { data: allNodes } = await supabase
        .from('nodes')
        .select('*')
        .eq('project_id', activeConvId)
      if (!allNodes) return

      const enriched = enrichDbNodes(allNodes as DbNode[])
      setAllDbNodes(enriched)
      const nodeMap = new Map(enriched.map((n) => [n.id, n]))

      // Walk UP: ancestors from root to clicked node
      const ancestors: DbNode[] = []
      let cur: DbNode | undefined = nodeMap.get(nodeId)
      while (cur) {
        ancestors.unshift(cur)
        cur = cur.parent_id ? nodeMap.get(cur.parent_id) : undefined
      }

      // Build children map and sort by created_at for oldest-branch selection
      const childrenMap = new Map<string, DbNode[]>()
      for (const node of enriched) {
        if (node.parent_id) {
          if (!childrenMap.has(node.parent_id)) childrenMap.set(node.parent_id, [])
          childrenMap.get(node.parent_id)!.push(node)
        }
      }
      for (const children of childrenMap.values()) {
        children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }

      // Walk DOWN from clicked node, following the most recently visited
      // branch at each fork (newest child when never visited). Clicking a node
      // also makes its lineage the remembered branch at every upstream fork.
      const descendants = walkDownPreferred(childrenMap, nodeId, branchChoiceRef.current)
      recordPathChoices(branchChoiceRef.current, [...ancestors, ...descendants])
      if (activeConvId) persistBranchChoices(activeConvId, branchChoiceRef.current)

      // The user prompt to highlight is the user node of the clicked pair
      const clickedNode = nodeMap.get(nodeId)
      let highlightId: string | null = null
      if (clickedNode?.role === 'assistant') {
        const userParent = clickedNode.parent_id ? nodeMap.get(clickedNode.parent_id) : null
        highlightId = userParent?.id ?? null
      } else {
        highlightId = nodeId
      }

      isBranchPointRef.current = (childrenMap.get(nodeId) ?? []).length > 0

      setMessages([...ancestors, ...descendants].map(dbNodeToMessage))
      setSelectedNodeId(nodeId)
      setHighlightedMessageId(highlightId)
      if (activeConvId) localStorage.setItem(`lastNodeId_${activeConvId}`, nodeId)

      // Keep lastNodeIdRef at the selected pair's assistant so branching works from this node
      const lastAsst = [...ancestors].reverse().find((n) => n.role === 'assistant')
      if (lastAsst) lastNodeIdRef.current = lastAsst.id
    },
    [supabase, activeConvId]
  )

  // ── Merge overlay: persistence ────────────────────────────────────────────
  // Whether a source node may be merged into a target node (pure tree check),
  // exposed so the canvas can validate a drop target before writing anything.
  const canMergeInto = useCallback(
    (sourceNodeId: string, targetNodeId: string): boolean =>
      canMergeNodes(sourceNodeId, targetNodeId, new Map(allDbNodes.map((n) => [n.id, n]))),
    [allDbNodes],
  )

  // Persist a single merge link (Flow B drag, or adding to an existing pair).
  // Writes merge_sources on the TARGET node; the structural tree is untouched.
  const addMergeSource = useCallback(
    async (targetNodeId: string, sourceNodeId: string): Promise<boolean> => {
      const nodeMap = new Map(allDbNodes.map((n) => [n.id, n]))
      if (!canMergeNodes(sourceNodeId, targetNodeId, nodeMap)) return false
      const target = nodeMap.get(targetNodeId)
      if (!target) return false
      const next = [...(target.merge_sources ?? []), sourceNodeId]

      const { error } = await supabase.from('nodes').update({ merge_sources: next }).eq('id', targetNodeId)
      if (error) {
        if (error.code === '42703' || error.code === 'PGRST204') { notifyMergeUnavailable(); return false }
        console.error('add merge source failed', error)
        return false
      }
      // Reflect immediately so the light-blue edge appears without a refetch.
      setAllDbNodes((prev) => prev.map((n) => (n.id === targetNodeId ? { ...n, merge_sources: next } : n)))
      return true
    },
    [allDbNodes, supabase, notifyMergeUnavailable],
  )

  // Remove one merge link; writes null when the last one is gone so "no merges"
  // stays a clean IS NOT NULL check.
  const removeMergeSource = useCallback(
    async (targetNodeId: string, sourceNodeId: string): Promise<boolean> => {
      const target = allDbNodes.find((n) => n.id === targetNodeId)
      if (!target || !Array.isArray(target.merge_sources)) return false
      const next = target.merge_sources.filter((id) => id !== sourceNodeId)
      const value = next.length > 0 ? next : null

      const { error } = await supabase.from('nodes').update({ merge_sources: value }).eq('id', targetNodeId)
      if (error) {
        if (error.code === '42703' || error.code === 'PGRST204') { notifyMergeUnavailable(); return false }
        console.error('remove merge source failed', error)
        return false
      }
      setAllDbNodes((prev) => prev.map((n) => (n.id === targetNodeId ? { ...n, merge_sources: value ?? undefined } : n)))
      return true
    },
    [allDbNodes, supabase, notifyMergeUnavailable],
  )

  // Arm a Flow-A merge: focus the anchor branch and stash the other tips, so the
  // user's next prompt forks from the anchor with those branches converged in.
  const beginMerge = useCallback(
    async (anchorTipId: string, mergeSourceIds: string[]): Promise<void> => {
      await handleNodeClick(anchorTipId)
      const parentId = lastNodeIdRef.current
      if (!parentId) return
      // Don't include the anchor's own lineage as a merge source.
      const nodeMap = new Map(allDbNodes.map((n) => [n.id, n]))
      const sources = mergeSourceIds.filter((id) => id !== parentId && canMergeNodes(id, parentId, nodeMap))
      pendingMergeRef.current = { parentId, mergeSources: sources }
      chatInputRef.current?.focus()
    },
    [handleNodeClick, allDbNodes],
  )

  // ── Prompt version info (sibling user nodes) ──────────────────────────────
  // Backs the ‹ n/m › indicator under an edited prompt. A user node's
  // "versions" are its siblings — the other user nodes sharing its parent (the
  // other edits/forks from that point). Returns null when there's only one.
  const promptVersionInfo = useCallback(
    (userNodeId: string): PromptVersionInfo | null => {
      const node = allDbNodes.find((n) => n.id === userNodeId)
      if (!node || node.role !== 'user') return null
      const siblings = allDbNodes
        .filter((n) => n.role === 'user' && (n.parent_id ?? null) === (node.parent_id ?? null))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      if (siblings.length <= 1) return null
      const index = siblings.findIndex((s) => s.id === userNodeId)
      return {
        index,
        total: siblings.length,
        prevId: index > 0 ? siblings[index - 1].id : null,
        nextId: index < siblings.length - 1 ? siblings[index + 1].id : null,
      }
    },
    [allDbNodes],
  )

  // Surface the "Node deleted — Undo" toast for 10s. A fresh deletion replaces
  // any current toast (and its timer), so the toast always tracks the latest.
  const showUndoToast = useCallback((id: string) => {
    if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current)
    setUndoToast({ id })
    undoToastTimerRef.current = setTimeout(() => {
      setUndoToast((t) => (t && t.id === id ? null : t))
      undoToastTimerRef.current = null
    }, 10000)
  }, [])

  // Clear the toast timer on unmount so it can't fire into a dead component.
  useEffect(() => () => { if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current) }, [])

  // ── Delete a node (a prompt + its reply) ──────────────────────────────────
  // `pairId` is a tree pair id, i.e. the assistant node's id (or the user
  // node's id when no reply exists yet). We delete the user node and its
  // assistant reply together, but ONLY if nothing is forked beneath them —
  // a node with branches below stays put so its descendants aren't orphaned.
  const deleteNode = useCallback(
    async (pairId: string): Promise<boolean> => {
      if (!activeConvId) return false
      const nodeMap = new Map(allDbNodes.map((n) => [n.id, n]))
      const anchor = nodeMap.get(pairId)
      if (!anchor) return false

      // Resolve the user node + assistant node that make up this pair.
      let userNode: DbNode | undefined
      let aiNode: DbNode | undefined
      if (anchor.role === 'assistant') {
        aiNode = anchor
        userNode = anchor.parent_id ? nodeMap.get(anchor.parent_id) : undefined
      } else {
        userNode = anchor
        aiNode = allDbNodes.find((n) => n.parent_id === anchor.id && n.role === 'assistant')
      }
      if (!userNode) return false

      const ids = new Set<string>([userNode.id])
      if (aiNode) ids.add(aiNode.id)

      // Guard: refuse if anything is forked beneath this pair. "Below" = any
      // node parented to one of our nodes that isn't itself part of the pair.
      const hasBranches = allDbNodes.some(
        (n) => n.parent_id != null && ids.has(n.parent_id) && !ids.has(n.id),
      )
      if (hasBranches) return false

      // Snapshot before deleting (user-first so an undo re-insert keeps the
      // assistant's parent link valid). Captured here while the rows are still
      // in hand; pushed to the undo stack only once the delete succeeds.
      const snapshot: DbNode[] = aiNode ? [userNode, aiNode] : [userNode]
      const focusId = aiNode?.id ?? userNode.id
      const convId  = activeConvId

      const idList = [...ids]
      const { error } = await supabase.from('nodes').delete().in('id', idList)
      if (error) { console.error('Delete node failed', error); return false }

      // Record the deletion so Ctrl+Z / the toast can restore it.
      const entry: UndoEntry = { id: `undo_${++undoSeqRef.current}`, convId, nodes: snapshot, focusId }
      undoStackRef.current = [...undoStackRef.current, entry].slice(-30)
      showUndoToast(entry.id)

      // Any node that merged one of the deleted nodes now has a dangling link —
      // strip it so the DB doesn't accumulate orphans. The render layer already
      // ignores unresolved source ids, so this is just housekeeping; do it
      // fire-and-forget and reflect it in local state below.
      const orphanedTargets = allDbNodes.filter(
        (n) => Array.isArray(n.merge_sources) && n.merge_sources.some((sid) => ids.has(sid)),
      )
      for (const t of orphanedTargets) {
        const cleaned = (t.merge_sources ?? []).filter((sid) => !ids.has(sid))
        void supabase.from('nodes').update({ merge_sources: cleaned.length ? cleaned : null }).eq('id', t.id)
      }

      // Drop the deleted rows from local state and forget their derived data.
      setAllDbNodes((prev) => prev
        .filter((n) => !ids.has(n.id))
        .map((n) => {
          if (!Array.isArray(n.merge_sources) || !n.merge_sources.some((sid) => ids.has(sid))) return n
          const cleaned = n.merge_sources.filter((sid) => !ids.has(sid))
          return { ...n, merge_sources: cleaned.length ? cleaned : undefined }
        }))
      setNodeColors((prev) => {
        const next = { ...prev }; idList.forEach((id) => delete next[id]); return next
      })
      setNodeSummaries((prev) => {
        const next = { ...prev }; idList.forEach((id) => delete next[id]); return next
      })
      idList.forEach((id) => { try { localStorage.removeItem(`node_meta_v1_${id}`) } catch {} })

      // Re-anchor the view. If we deleted what was selected, fall back to the
      // prompt's parent (the reply above it); deleting a root with no parent
      // empties the conversation. handleNodeClick re-reads the now-trimmed tree
      // and rebuilds the active path, so it stays consistent either way.
      const selectionDeleted = selectedNodeId != null && ids.has(selectedNodeId)
      const target = selectionDeleted ? userNode.parent_id : selectedNodeId
      if (target) {
        await handleNodeClick(target)
      } else if (selectionDeleted) {
        setMessages([])
        setSelectedNodeId(null)
        setHighlightedMessageId(null)
        lastNodeIdRef.current = null
        try { localStorage.removeItem(`lastNodeId_${activeConvId}`) } catch {}
      }
      return true
    },
    [activeConvId, allDbNodes, selectedNodeId, supabase, handleNodeClick, showUndoToast],
  )

  // ── Undo a node deletion ──────────────────────────────────────────────────
  // Re-inserts the snapshotted rows (preserving their ids/created_at so they
  // land back in their original spot), then brings them into view. Defaults to
  // the most recent deletion (Ctrl+Z); the toast passes a specific entry id.
  const undoDelete = useCallback(
    async (entryId?: string): Promise<void> => {
      const stack = undoStackRef.current
      if (stack.length === 0) return
      const idx = entryId ? stack.findIndex((e) => e.id === entryId) : stack.length - 1
      if (idx < 0) return
      const entry = stack[idx]

      // Pop it up front so a double Ctrl+Z can't restore the same rows twice.
      undoStackRef.current = [...stack.slice(0, idx), ...stack.slice(idx + 1)]
      setUndoToast((t) => (t && t.id === entry.id ? null : t))

      // If the conversation itself is gone, there's nowhere to restore to.
      const conv = conversations.find((c) => c.id === entry.convId)
      if (!conv) return

      for (const n of entry.nodes) {
        const row: Record<string, unknown> = {
          id: n.id, project_id: n.project_id, parent_id: n.parent_id,
          role: n.role, content: n.content,
          position_x: n.position_x, position_y: n.position_y, created_at: n.created_at,
        }
        if (n.color) row.color = n.color
        if (n.attachments && n.attachments.length) row.attachments = n.attachments
        let { error } = await supabase.from('nodes').insert(row)
        // Older schemas may lack the attachments column — retry without it (the
        // content still carries the inline attachment marker, so nothing is lost).
        if (error && (error.code === '42703' || error.code === 'PGRST204')) {
          delete row.attachments
          ;({ error } = await supabase.from('nodes').insert(row))
        }
        if (error) { console.error('Undo restore failed', error); return }
      }

      // Restore any per-node colour we had cleared on delete.
      setNodeColors((prev) => {
        const next = { ...prev }
        for (const n of entry.nodes) { if (n.color) next[n.id] = n.color }
        return next
      })

      // Bring the node back into view and select it. Same conversation → just
      // re-walk the tree; a different one → load it (seeding the saved-node so
      // loadConversation lands on the restored node).
      if (entry.convId === activeConvId) {
        await handleNodeClick(entry.focusId)
      } else {
        try { localStorage.setItem(`lastNodeId_${entry.convId}`, entry.focusId) } catch {}
        deleteIfEmpty()
        await loadConversation(entry.convId, conv.name)
      }
    },
    [activeConvId, supabase, handleNodeClick, conversations, deleteIfEmpty, loadConversation],
  )

  // Ctrl/Cmd+Z restores the most recent node deletion — but never while the
  // user is typing (that's the browser's own text undo), and only when there's
  // something to undo (so we don't swallow the shortcut otherwise).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key !== 'z' && e.key !== 'Z') || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (undoStackRef.current.length === 0) return
      e.preventDefault()
      void undoDelete()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undoDelete])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  // The active conversation shows an "Update" button when it was imported from a
  // source (carries provenance). Reads off the in-memory list, which includes
  // the source_* columns from the projects load.
  const activeConvIsImported = !!(() => {
    const c = conversations.find((c) => c.id === activeConvId)
    return c?.source && c?.source_conversation_id
  })()
  // The active conversation's source provider key (e.g. 'claude'), or null when
  // it's a native Nodea conversation. Lets the chat panel tag imported messages
  // with the source's own icon instead of the native model logo.
  const activeConvSource = conversations.find((c) => c.id === activeConvId)?.source ?? null

  // ─────────────────────────────────────────────────────────────────────────
  const ctx: AppContextType = {
    conversations, activeConvId, convName, allDbNodes, messages, selectedNodeId,
    input, setInput, isLoading, inFlightConvIds,
    isSearchOpen, setIsSearchOpen, isSettingsOpen, setIsSettingsOpen,
    isUpgradeOpen, setIsUpgradeOpen,
    isChatCollapsed, setIsChatCollapsed,
    handleSend, handleNodeClick, editUserMessage, promptVersionInfo, switchConversation, createConversation,
    renameConversation, deleteConversation,
    activeConvIsImported, activeConvSource, updateFromSource, isUpdatingSource, signOut,
    userEmail, userName, setUserName, isAdmin, isPro,
    nodeColors, setNodeColor, deleteNode,
    canMergeInto, addMergeSource, removeMergeSource, beginMerge, mergeNotice, clearMergeNotice,
    nodeSummaries, chatInputRef,
    pendingAttachments, addAttachment, removeAttachment,
    lastSavedPairId,
    chatError, clearChatError, saveError, clearSaveError,
    highlightedMessageId,
    settingsInitialSection, setSettingsInitialSection,
    memorySavedByMsgId,
    // ── Chat Projects ──
    chatProjects, activeChatProjectId, view,
    openProjectsLanding, openProject, openChatView,
    openNewProjectModal,
    openConvContext, openProjectContext,
    assignConvToProject, requestNewChatInProject,
  }

  const activeChatProject = activeChatProjectId
    ? chatProjects.find((p) => p.id === activeChatProjectId) ?? null
    : null

  // Drag-target id for ProjectsLanding cards. Kept local; the Sidebar manages
  // its own. We expose minimal setters via callbacks below.
  const [landingDropTarget, setLandingDropTarget] = useState<string | null>(null)

  return (
    <AppContext.Provider value={ctx}>
      {isMobile ? (
        <MobileApp onSaveMemory={saveProjectMemory} />
      ) : (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <Sidebar />
        {view === 'chat' && (
          <>
            <div style={{
              flex: isChatCollapsed ? '0 0 44px' : 1,
              display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0,
            }}>
              <ChatPanel />
            </div>
            <TreePanel />
            <TreeSummaryCard key={activeConvId ?? 'none'} />
          </>
        )}
        {view === 'projects' && (
          <ProjectsLanding
            projects={chatProjects}
            conversations={conversations}
            dropTarget={landingDropTarget}
            onOpen={openProject}
            onCreate={openNewProjectModal}
            onContext={(p, x, y) => openProjectContext(p, x, y)}
            onDragOverProject={setLandingDropTarget}
            onDragLeaveProject={(id) => setLandingDropTarget((t) => (t === id ? null : t))}
            onDropOnProject={(projectId, convId) => {
              setLandingDropTarget(null)
              assignConvToProject(convId, projectId)
            }}
          />
        )}
        {view === 'project' && activeChatProject && (
          <ProjectPage
            project={activeChatProject}
            conversations={conversations}
            onBack={openProjectsLanding}
            onOpenConv={(id) => { setActiveConvId(id); setView('chat'); switchConversation(id) }}
            onNewChat={(msg) => requestNewChatInProject(activeChatProject.id, msg)}
            onConvContext={(conv, x, y) => openConvContext(conv, x, y)}
            onEdit={() => setProjectModalState({ mode: 'edit', project: activeChatProject })}
            onDelete={() => setDeleteProjectState(activeChatProject)}
            onSaveMemory={(memory) => saveProjectMemory(activeChatProject.id, memory)}
          />
        )}
      </div>
      )}

      {/* Existing modals */}
      {isSearchOpen  && <SearchModal />}
      {isSettingsOpen && <SettingsModal />}
      {isUpgradeOpen && <UpgradeModal />}

      {/* Projects modals */}
      {projectModalState && (
        <ProjectModal
          editing={projectModalState.mode === 'edit' ? projectModalState.project : null}
          onClose={() => setProjectModalState(null)}
          onSave={saveProject}
        />
      )}
      {deleteProjectState && (
        <DeleteProjectModal
          project={deleteProjectState}
          onClose={() => setDeleteProjectState(null)}
          onConfirm={confirmDeleteProject}
        />
      )}
      {editConvState && (
        <EditConversationModal
          conv={editConvState}
          projects={chatProjects}
          isPro={isPro}
          onClose={() => setEditConvState(null)}
          onSave={(changes) => saveConvEdit(editConvState.id, changes)}
          onUpgradeRequired={() => { setEditConvState(null); setIsUpgradeOpen(true) }}
        />
      )}

      {/* Context menus */}
      {convMenu && (
        <ConvContextMenu
          x={convMenu.x}
          y={convMenu.y}
          conv={convMenu.conv}
          projects={chatProjects}
          isPro={isPro}
          onMove={(pid) => assignConvToProject(convMenu.conv.id, pid)}
          onRemove={() => assignConvToProject(convMenu.conv.id, null)}
          onColor={(color) => setConvColor(convMenu.conv.id, color)}
          onEdit={() => setEditConvState(convMenu.conv)}
          onDelete={() => deleteConversation(convMenu.conv.id)}
          onUpgradeRequired={() => { setConvMenu(null); setIsUpgradeOpen(true) }}
          onClose={() => setConvMenu(null)}
        />
      )}
      {projectMenu && (
        <ProjectActionMenu
          x={projectMenu.x}
          y={projectMenu.y}
          project={projectMenu.project}
          onOpen={() => openProject(projectMenu.project.id)}
          onTogglePin={() => toggleProjectPin(projectMenu.project.id)}
          onEdit={() => setProjectModalState({ mode: 'edit', project: projectMenu.project })}
          onDelete={() => setDeleteProjectState(projectMenu.project)}
          onClose={() => setProjectMenu(null)}
        />
      )}

      {/* Undo toast — appears for 10s after a node deletion (Ctrl/Cmd+Z also works) */}
      {undoToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--modal-bg)', color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)', borderRadius: 12,
            boxShadow: 'var(--shadow-lg)', padding: '10px 12px 10px 16px',
            zIndex: 10000, fontSize: 13.5, maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" />
            </svg>
            Node deleted
          </span>
          <button
            type="button"
            onClick={() => undoDelete(undoToast.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontWeight: 600, fontSize: 13.5, padding: '3px 5px', borderRadius: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h11a5 5 0 0 1 0 10h-2" />
            </svg>
            Undo
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setUndoToast(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', lineHeight: 0, borderRadius: 6 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {mergeNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--modal-bg)', color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)', borderRadius: 12,
            boxShadow: 'var(--shadow-lg)', padding: '10px 12px 10px 16px',
            zIndex: 10000, fontSize: 13.5, maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            {mergeNotice}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={clearMergeNotice}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', lineHeight: 0, borderRadius: 6 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {importNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--modal-bg)', color: 'var(--text-primary)',
            border: `1px solid ${importNotice.tone === 'error' ? '#ef4444' : 'var(--border-strong)'}`,
            borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: '10px 12px 10px 16px',
            zIndex: 10001, fontSize: 13.5, maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={importNotice.tone === 'error' ? '#ef4444' : '#38bdf8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            {importNotice.text}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={clearImportNotice}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', lineHeight: 0, borderRadius: 6 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </AppContext.Provider>
  )
}

// ─── ProjectActionMenu — right-click menu for a project chip / card ──────────
// (Lightweight, scoped to App so we don't add another file for ~50 lines.)

interface ProjectActionMenuProps {
  x: number
  y: number
  project: ChatProject
  onOpen: () => void
  onTogglePin: () => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

function ProjectActionMenu({
  x, y, project, onOpen, onTogglePin, onEdit, onDelete, onClose,
}: ProjectActionMenuProps) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ x, y })

  // Ref-callback measurement: clamp the menu inside the viewport without
  // setting state inside an effect (avoids `react-hooks/set-state-in-effect`).
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = Math.min(x, window.innerWidth  - r.width  - 8)
    const ny = Math.min(y, window.innerHeight - r.height - 8)
    if (nx !== x || ny !== y) setPos({ x: nx, y: ny })
  }, [x, y])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (elRef.current && !elRef.current.contains(e.target as Node)) onClose()
    }
    function key(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  const item = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '8px 12px', fontSize: 13,
    color: 'var(--text-secondary)',
    background: 'transparent', border: 'none',
    cursor: 'pointer', textAlign: 'left' as const, borderRadius: 7,
  }
  const hov = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    e.currentTarget.style.background = on ? 'var(--bg-subtle)' : 'transparent'
  }

  return (
    <div
      ref={measureRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: pos.x, top: pos.y, zIndex: 1200, width: 184,
        background: 'var(--modal-bg)',
        border: '1px solid var(--border)',
        borderRadius: 11,
        boxShadow: 'var(--shadow-lg)',
        padding: 5,
      }}
    >
      <button type="button" style={item} onClick={() => { onOpen(); onClose() }} onMouseEnter={(e) => hov(e, true)} onMouseLeave={(e) => hov(e, false)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        Open project
      </button>
      <button type="button" style={item} onClick={() => { onTogglePin(); onClose() }} onMouseEnter={(e) => hov(e, true)} onMouseLeave={(e) => hov(e, false)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <path d="M9 4h6l-1 6 3 3v2h-5v5l-1 1-1-1v-5H4v-2l3-3z" />
        </svg>
        {project.pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
      </button>
      <button type="button" style={item} onClick={() => { onEdit(); onClose() }} onMouseEnter={(e) => hov(e, true)} onMouseLeave={(e) => hov(e, false)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <path d="M4 20h4l10-10-4-4L4 16z" />
          <path d="M13.5 6.5l4 4" />
        </svg>
        Edit
      </button>
      <div style={{ height: 1, background: 'var(--border)', margin: '5px 8px' }} />
      <button
        type="button"
        style={{ ...item, color: 'var(--color-error)' }}
        onClick={() => { onDelete(); onClose() }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-bg)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" />
        </svg>
        Delete
      </button>
    </div>
  )
}
