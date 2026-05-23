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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  name: string
  user_id: string
  created_at: string
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
  isSearchOpen: boolean
  setIsSearchOpen: (b: boolean) => void
  isSettingsOpen: boolean
  setIsSettingsOpen: (b: boolean) => void
  isUpgradeOpen: boolean
  setIsUpgradeOpen: (b: boolean) => void
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
}

export const AppContext = createContext<AppContextType>({} as AppContextType)
export const useApp = () => useContext(AppContext)

class RateLimitError extends Error {
  readonly isRateLimit = true
}

function formatRateLimitMessage(data: { limit_type?: string; resets_at?: string }): string {
  if (data.limit_type === 'daily') {
    const t = data.resets_at
      ? new Date(data.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'midnight'
    return `You've reached your daily usage limit. Your limit resets at ${t}. Upgrade for more.`
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
  const [isLoading,     setIsLoading]       = useState(false)
  const [isSearchOpen,  setIsSearchOpen]    = useState(false)
  const [isSettingsOpen,setIsSettingsOpen]  = useState(false)
  const [isUpgradeOpen, setIsUpgradeOpen]  = useState(false)
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

  const lastNodeIdRef     = useRef<string | null>(null)
  const isBranchPointRef  = useRef(false)
  const chatInputRef      = useRef<HTMLTextAreaElement | null>(null)

  const clearChatError  = useCallback(() => setChatError(null), [])
  const clearSaveError  = useCallback(() => setSaveError(false), [])

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

  // Delete the active conv if it's empty (no DB nodes). Only safe after load completes.
  // Returns true if a deletion happened (so callers can update local lists accordingly).
  const deleteIfEmpty = useCallback((): string | null => {
    console.log(`[deleteIfEmpty] activeConvId=${activeConvId} isCurrentLoaded=${isCurrentLoaded} dbNodesLen=${allDbNodes.length}`)
    if (!activeConvId || !isCurrentLoaded || allDbNodes.length > 0) return null
    const oldId = activeConvId
    console.log('[deleteIfEmpty] DELETING', oldId)
    setConversations((prev) => prev.filter((c) => c.id !== oldId))
    supabase.from('projects').delete().eq('id', oldId).then(({ error }) => {
      if (error) console.error('Auto-delete empty conv failed', error)
    })
    return oldId
  }, [activeConvId, isCurrentLoaded, allDbNodes, supabase])

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email ?? '')
      setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'User')

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

      setConversations(projects as Conversation[])
      const lastId = localStorage.getItem('lastConvId')
      const initial = (projects as Conversation[]).find((p) => p.id === lastId) ?? projects[0]
      await loadConversation(initial.id, initial.name)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    setConversations((prev) => [...prev, project])
    await loadConversation(project.id, project.name)
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

  // ── Save a user+assistant node pair after a response ─────────────────────
  const saveNodePair = useCallback(
    async (userContent: string, assistantContent: string, attachments?: AttachmentItem[]) => {
      const pid = activeConvId
      if (!pid) return

      const parentId = lastNodeIdRef.current
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
      // Fall back if the attachments column hasn't been migrated yet — the
      // attachment metadata still lives inside the content header.
      if (ue?.code === '42703') {
        ;({ data: userNode, error: ue } = await supabase
          .from('nodes')
          .insert({ project_id: pid, parent_id: parentId, role: 'user', content: persistedContent, position_x: 0, position_y: 0 })
          .select()
          .single())
      }
      if (ue || !userNode) { console.error('user node save failed', ue); setSaveError(true); return }

      const { data: asst, error: ae } = await supabase
        .from('nodes')
        .insert({ project_id: pid, parent_id: userNode.id, role: 'assistant', content: assistantContent, position_x: 0, position_y: 0 })
        .select()
        .single()
      if (ae || !asst) { console.error('assistant node save failed', ae); setSaveError(true); return }

      lastNodeIdRef.current = asst.id
      setSelectedNodeId(asst.id)
      localStorage.setItem(`lastNodeId_${pid}`, asst.id)
      setLastSavedPairId(asst.id)
      // Ensure the in-memory node has the attachments field populated (so the
      // tree picks them up immediately, even before a reload).
      const userNodeWithAtt: DbNode = { ...(userNode as DbNode), attachments: attachmentMeta }
      setAllDbNodes((prev) => [...prev, userNodeWithAtt, asst as DbNode])
    },
    [supabase, activeConvId]
  )

  // ── Send a message ────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const hasText = input.trim().length > 0
      const hasAttachments = pendingAttachments.length > 0
      if ((!hasText && !hasAttachments) || isLoading) return

      setChatError(null)
      setSaveError(false)
      setHighlightedMessageId(null)

      const userContent             = input.trim()
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
      setIsLoading(true)

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
          throw new RateLimitError(formatRateLimitMessage(data))
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
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            full += decoder.decode(value, { stream: true })
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = { id: assistantId, role: 'assistant', content: full, timestamp: Date.now() }
              return updated
            })
          }
        }
        if (full.trim()) {
          const isFirstPair = lastNodeIdRef.current === null
          await saveNodePair(userContent, full, attachmentsSnapshot)
          // lastNodeIdRef is now the new assistant node id (pair key)
          const newPairId = lastNodeIdRef.current

          // Fire-and-forget: generate AI title + summary for the node
          if (newPairId) {
            fetch('/api/autotitle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userPrompt: userContent, aiResponse: full, type: 'node' }),
            }).then(r => r.ok ? r.json() : null).then(data => {
              if (!data) return
              const meta = { title: data.title ?? '', summary: data.summary ?? '' }
              setNodeSummaries(prev => ({ ...prev, [newPairId]: meta }))
              localStorage.setItem(`node_meta_v1_${newPairId}`, JSON.stringify(meta))
            }).catch(() => {})
          }

          // Fire-and-forget: auto-title the conversation on its first message
          if (isFirstPair && activeConvId) {
            const convId = activeConvId
            fetch('/api/autotitle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userPrompt: userContent, type: 'conversation' }),
            }).then(r => r.ok ? r.json() : null).then(data => {
              if (data?.title) renameConversation(convId, data.title)
            }).catch(() => {})
          }
        }
      } catch (err) {
        console.error('Chat error', err)
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantId))
        if (err instanceof RateLimitError) {
          setIsUpgradeOpen(true)
        } else {
          setInput(userContent)
          // Restore the *local* (data: URL) snapshot so the chips still have a
          // preview thumbnail to render after a failed send.
          if (localAttachmentsSnapshot) setPendingAttachments(localAttachmentsSnapshot)
          setChatError(
            err instanceof Error
              ? err.message
              : 'Failed to get a response. Check your connection and try again.',
          )
        }
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, messages, saveNodePair, pendingAttachments, activeConvId, renameConversation]
  )

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
    input, setInput, isLoading,
    isSearchOpen, setIsSearchOpen, isSettingsOpen, setIsSettingsOpen,
    isUpgradeOpen, setIsUpgradeOpen,
    handleSend, handleNodeClick, switchConversation, createConversation,
    renameConversation, deleteConversation, signOut,
    userEmail, userName, setUserName, isAdmin, isPro,
    nodeColors, setNodeColor, nodeSummaries, chatInputRef,
    pendingAttachments, addAttachment, removeAttachment,
    lastSavedPairId,
    chatError, clearChatError, saveError, clearSaveError,
    highlightedMessageId,
    settingsInitialSection, setSettingsInitialSection,
  }

  return (
    <AppContext.Provider value={ctx}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <ChatPanel />
        </div>
        <TreePanel />
      </div>
      {isSearchOpen  && <SearchModal />}
      {isSettingsOpen && <SettingsModal />}
      {isUpgradeOpen && <UpgradeModal />}
    </AppContext.Provider>
  )
}
