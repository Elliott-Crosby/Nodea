'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from './Sidebar'
import ChatPanel from './ChatPanel'
import TreePanel from './TreePanel'
import SearchModal from './SearchModal'
import SettingsModal from './SettingsModal'

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
  model: string
  setModel: (m: string) => void
  isSearchOpen: boolean
  setIsSearchOpen: (b: boolean) => void
  isSettingsOpen: boolean
  setIsSettingsOpen: (b: boolean) => void
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
  nodeColors: Record<string, string>
  setNodeColor: (id: string, color: string) => void
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>
  pendingAttachments: AttachmentItem[]
  addAttachment: (a: AttachmentItem) => void
  removeAttachment: (name: string) => void
  lastSavedPairId: string | null
  chatError: string | null
  clearChatError: () => void
  saveError: boolean
  clearSaveError: () => void
}

export const AppContext = createContext<AppContextType>({} as AppContextType)
export const useApp = () => useContext(AppContext)

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

export const MODELS = [
  { id: 'auto',   label: 'Auto',   apiId: 'claude-haiku-4-5-20251001' },
  { id: 'haiku',  label: 'Haiku',  apiId: 'claude-haiku-4-5-20251001' },
  { id: 'sonnet', label: 'Sonnet', apiId: 'claude-sonnet-4-5-20251001' },
  { id: 'opus',   label: 'Opus',   apiId: 'claude-opus-4-5-20251001' },
]

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
  const [input,         setInput]           = useState('')
  const [isLoading,     setIsLoading]       = useState(false)
  const [model,         setModel]           = useState('auto')
  const [isSearchOpen,  setIsSearchOpen]    = useState(false)
  const [isSettingsOpen,setIsSettingsOpen]  = useState(false)
  const [userEmail,     setUserEmail]       = useState('')
  const [userName,      setUserName]        = useState('')
  const [nodeColors,    setNodeColors]      = useState<Record<string, string>>({})
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([])
  const [lastSavedPairId, setLastSavedPairId] = useState<string | null>(null)
  const [chatError,     setChatError]       = useState<string | null>(null)
  const [saveError,     setSaveError]       = useState(false)

  const lastNodeIdRef = useRef<string | null>(null)
  const chatInputRef  = useRef<HTMLTextAreaElement | null>(null)

  const clearChatError  = useCallback(() => setChatError(null), [])
  const clearSaveError  = useCallback(() => setSaveError(false), [])

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
      setActiveConvId(convId)
      setConvName(name)
      setMessages([])
      setSelectedNodeId(null)
      setNodeColors({})
      lastNodeIdRef.current = null

      const { data: dbNodes, error } = await supabase
        .from('nodes')
        .select('*')
        .eq('project_id', convId)
        .order('created_at', { ascending: true })

      if (error || !dbNodes?.length) {
        setAllDbNodes([])
        return
      }

      setAllDbNodes(dbNodes as DbNode[])

      // Restore persisted node colors (Task 1)
      const colorMap: Record<string, string> = {}
      for (const n of dbNodes as DbNode[]) {
        if (n.color) colorMap[n.id] = n.color
      }
      setNodeColors(colorMap)

      const assistantNodes = (dbNodes as DbNode[]).filter((n) => n.role === 'assistant')
      if (assistantNodes.length) {
        const lastAsst = assistantNodes[assistantNodes.length - 1]
        lastNodeIdRef.current = lastAsst.id
        setSelectedNodeId(lastAsst.id)

        const nodeMap = new Map((dbNodes as DbNode[]).map((n) => [n.id, n]))
        const chain: DbNode[] = []
        let cur: DbNode | undefined = lastAsst
        while (cur) {
          chain.unshift(cur)
          cur = cur.parent_id ? nodeMap.get(cur.parent_id) : undefined
        }
        setMessages(
          chain.map((n) => ({
            id: n.id,
            role: n.role,
            content: n.content,
            timestamp: new Date(n.created_at).getTime(),
          }))
        )
      }
    },
    [supabase]
  )

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // Apply saved font size (Task 8)
      const savedSize = localStorage.getItem('nodea-font-size') || 'medium'
      const sizeMap: Record<string, string> = { small: '13px', medium: '15px', large: '17px' }
      document.documentElement.style.setProperty('--font-size-base', sizeMap[savedSize] ?? '15px')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email ?? '')
      setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'User')

      const res = await fetch('/api/projects')
      if (!res.ok) { router.push('/login'); return }
      const { projects } = await res.json()
      if (!projects?.length) {
        setConvName('')
        return
      }

      setConversations(projects as Conversation[])
      await loadConversation(projects[0].id, projects[0].name)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cmd/Ctrl+K — open search (Task 2) ────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (chatInputRef.current && document.activeElement === chatInputRef.current) return
        e.preventDefault()
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
      await loadConversation(id, conv.name)
    },
    [conversations, loadConversation]
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
    setConversations((prev) => [...prev, project])
    await loadConversation(project.id, project.name)
  }, [loadConversation])

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
    async (userContent: string, assistantContent: string) => {
      const pid = activeConvId
      if (!pid) return

      const parentId = lastNodeIdRef.current

      const { data: userNode, error: ue } = await supabase
        .from('nodes')
        .insert({ project_id: pid, parent_id: parentId, role: 'user', content: userContent, position_x: 0, position_y: 0 })
        .select()
        .single()
      if (ue || !userNode) { console.error('user node save failed', ue); setSaveError(true); return }

      const { data: asst, error: ae } = await supabase
        .from('nodes')
        .insert({ project_id: pid, parent_id: userNode.id, role: 'assistant', content: assistantContent, position_x: 0, position_y: 0 })
        .select()
        .single()
      if (ae || !asst) { console.error('assistant node save failed', ae); setSaveError(true); return }

      lastNodeIdRef.current = asst.id
      setSelectedNodeId(asst.id)
      setLastSavedPairId(asst.id)
      setAllDbNodes((prev) => [...prev, userNode as DbNode, asst as DbNode])
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

      const userContent        = input.trim()
      const attachmentsSnapshot = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined
      const now                 = Date.now()
      const userMsg: ChatMessage = {
        id: now.toString(), role: 'user', content: userContent,
        timestamp: now, attachments: attachmentsSnapshot,
      }
      const assistantId = (now + 1).toString()

      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setPendingAttachments([])
      setIsLoading(true)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages, model }),
        })
        if (!response.ok) throw new Error('Chat request failed')

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() },
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
        await saveNodePair(userContent, full)
      } catch (err) {
        console.error('Chat error', err)
        // Restore the user's message to input so they can retry (Task 7)
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantId))
        setInput(userContent)
        if (attachmentsSnapshot) setPendingAttachments(attachmentsSnapshot)
        setChatError('Failed to get a response. Check your connection and try again.')
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, messages, model, saveNodePair, pendingAttachments]
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

      setAllDbNodes(allNodes as DbNode[])
      const nodeMap = new Map((allNodes as DbNode[]).map((n) => [n.id, n]))

      const chain: DbNode[] = []
      let cur: DbNode | undefined = nodeMap.get(nodeId)
      while (cur) {
        chain.unshift(cur)
        cur = cur.parent_id ? nodeMap.get(cur.parent_id) : undefined
      }

      setMessages(
        chain.map((n) => ({
          id: n.id, role: n.role, content: n.content,
          timestamp: new Date(n.created_at).getTime(),
        }))
      )
      setSelectedNodeId(nodeId)

      const lastAsst = [...chain].reverse().find((n) => n.role === 'assistant')
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
    input, setInput, isLoading, model, setModel,
    isSearchOpen, setIsSearchOpen, isSettingsOpen, setIsSettingsOpen,
    handleSend, handleNodeClick, switchConversation, createConversation,
    renameConversation, deleteConversation, signOut,
    userEmail, userName, setUserName,
    nodeColors, setNodeColor, chatInputRef,
    pendingAttachments, addAttachment, removeAttachment,
    lastSavedPairId,
    chatError, clearChatError, saveError, clearSaveError,
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
    </AppContext.Provider>
  )
}
