'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { createClient } from '@/lib/supabase'
import { trackEvent } from '@/lib/track-event'
import Sidebar from './Sidebar'
import ChatPanel from './ChatPanel'
import TreePanel from './TreePanel'
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
}

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
}

export interface NodeAttachment {
  name: string
  type: string
  url?: string  // Supabase Storage URL — present once the file has been uploaded
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
    if (n.role !== 'user') return n
    if (n.attachments && n.attachments.length > 0) return n  // already populated from DB column
    const { attachments } = parseUserContent(n.content)
    return attachments.length > 0 ? { ...n, attachments } : n
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
  }
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
  switchConversation: (id: string) => Promise<void>
  createConversation: () => Promise<void>
  renameConversation: (id: string, name: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  signOut: () => void
  userEmail: string
  userName: string
  setUserName: (n: string) => void
  isAdmin: boolean
  isPro: boolean
  nodeColors: Record<string, string>
  setNodeColor: (id: string, color: string) => void
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

  const lastNodeIdRef     = useRef<string | null>(null)
  const isBranchPointRef  = useRef(false)
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

  const clearChatError  = useCallback(() => setChatError(null), [])
  const clearSaveError  = useCallback(() => setSaveError(false), [])

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

      const enriched = enrichDbNodes(dbNodes as DbNode[])
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

        // Build children map so we can walk DOWN
        const childrenMap = new Map<string, DbNode[]>()
        for (const node of dbNodes as DbNode[]) {
          if (node.parent_id) {
            if (!childrenMap.has(node.parent_id)) childrenMap.set(node.parent_id, [])
            childrenMap.get(node.parent_id)!.push(node)
          }
        }
        for (const children of childrenMap.values()) {
          children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }

        // Walk DOWN from target node following oldest branch
        const descendants: DbNode[] = []
        let tipId = targetNode.id
        while (true) {
          const children = childrenMap.get(tipId) ?? []
          if (children.length === 0) break
          descendants.push(children[0])
          tipId = children[0].id
        }

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const displayName = user.user_metadata?.display_name
      if (typeof displayName !== 'string' || displayName.trim().length === 0) {
        router.push('/welcome')
        return
      }
      setUserEmail(user.email ?? '')
      setUserName(displayName)

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
    ): Promise<DbNode | null> => {
      if (!pid) return null

      const attachmentMeta: NodeAttachment[] =
        attachments?.map((a) => ({ name: a.name, type: a.type, url: a.dataUrl })) ?? []

      // Embed attachment URLs in the content itself so they roundtrip through
      // the DB without needing a schema migration — and so when the user forks
      // a branch from this node, the next request still has the image URLs.
      const persistedContent = serializeUserContent(userContent, attachmentMeta)

      let { data: userNode, error: ue } = await supabase
        .from('nodes')
        .insert({ project_id: pid, parent_id: parentId, role: 'user', content: persistedContent, position_x: 0, position_y: 0, attachments: attachmentMeta })
        .select()
        .single()
      // Fall back if the attachments column isn't recognized. Two codes show up
      // here: Postgres-native 42703 (column truly missing) and PostgREST's
      // PGRST204 ("schema cache" — column exists but the API layer hasn't
      // refreshed yet). Either way, the attachment metadata still lives inside
      // the content header, so the retry is safe.
      if (ue?.code === '42703' || ue?.code === 'PGRST204') {
        ;({ data: userNode, error: ue } = await supabase
          .from('nodes')
          .insert({ project_id: pid, parent_id: parentId, role: 'user', content: persistedContent, position_x: 0, position_y: 0 })
          .select()
          .single())
      }
      if (ue || !userNode) {
        console.error('user node save failed', ue)
        if (activeConvIdRef.current === pid) setSaveError(true)
        return null
      }

      // The user node is now this conversation's branch tip — persist it so a
      // return restores the right path even before any reply lands.
      localStorage.setItem(`lastNodeId_${pid}`, userNode.id)
      if (activeConvIdRef.current === pid) {
        lastNodeIdRef.current = userNode.id
        const userNodeWithAtt: DbNode = { ...(userNode as DbNode), attachments: attachmentMeta }
        setAllDbNodes((prev) => [...prev, userNodeWithAtt])
      }
      return userNode as DbNode
    },
    [supabase]
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
    ): Promise<string | null> => {
      if (!pid || !userNodeId) return null

      const { data: asst, error: ae } = await supabase
        .from('nodes')
        .insert({ project_id: pid, parent_id: userNodeId, role: 'assistant', content: assistantContent, position_x: 0, position_y: 0 })
        .select()
        .single()
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

      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setPendingAttachments([])
      if (targetConvId) markInFlight(targetConvId)

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

      // The snapshot we'll actually send and persist. Starts as the local
      // (data: URL) snapshot, then upgrades to Storage-URL attachments once
      // the upload step completes below.
      let attachmentsSnapshot = localAttachmentsSnapshot
      // Set once the user message is persisted (before the model call); the
      // assistant reply is then saved as this node's child after the stream.
      let savedUserNodeId: string | null = null

      try {
        // Upload any newly-attached files (data: URLs) to Supabase Storage so
        // (1) the chat API request stays well under the 4.5 MB serverless cap,
        // and (2) the URL persists across branches without bloating the DB.
        if (localAttachmentsSnapshot?.some((a) => a.dataUrl.startsWith('data:'))) {
          const uploaded = await Promise.all(
            localAttachmentsSnapshot.map(async (a) => {
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
            m.id === userMsg.id ? { ...m, attachments: uploaded } : m
          ))
        }

        // Persist the user's message NOW — before the model call — so the
        // conversation has content and won't be auto-deleted if the reply is
        // slow, errors out, or the user switches away before it lands.
        if (targetConvId) {
          const savedUser = await saveUserNode(targetConvId, parentId, userContent, attachmentsSnapshot)
          savedUserNodeId = savedUser?.id ?? null
        }

        // Send messages with the post-upload attachments (URLs, not data:).
        const messagesForApi = nextMessages.map((m) =>
          m.id === userMsg.id ? { ...m, attachments: attachmentsSnapshot } : m
        )
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messagesForApi }),
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
          const newPairId = await saveAssistantNode(targetConvId, savedUserNodeId, full)

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
          if (isFirstPair) {
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
    [input, isLoading, messages, saveUserNode, saveAssistantNode, pendingAttachments, activeConvId, renameConversation, isPro, markInFlight, clearInFlight]
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

      // Walk DOWN from clicked node following oldest branch at each fork
      const descendants: DbNode[] = []
      let tipId = nodeId
      while (true) {
        const children = childrenMap.get(tipId) ?? []
        if (children.length === 0) break
        descendants.push(children[0])
        tipId = children[0].id
      }

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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  // ─────────────────────────────────────────────────────────────────────────
  const ctx: AppContextType = {
    conversations, activeConvId, convName, allDbNodes, messages, selectedNodeId,
    input, setInput, isLoading, inFlightConvIds,
    isSearchOpen, setIsSearchOpen, isSettingsOpen, setIsSettingsOpen,
    isUpgradeOpen, setIsUpgradeOpen,
    isChatCollapsed, setIsChatCollapsed,
    handleSend, handleNodeClick, switchConversation, createConversation,
    renameConversation, deleteConversation, signOut,
    userEmail, userName, setUserName, isAdmin, isPro,
    nodeColors, setNodeColor, nodeSummaries, chatInputRef,
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
          />
        )}
      </div>

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
