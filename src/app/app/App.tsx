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

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
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
  signOut: () => void
  userEmail: string
  userName: string
  setUserName: (n: string) => void
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

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [convName, setConvName] = useState('Loading…')
  const [allDbNodes, setAllDbNodes] = useState<DbNode[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [model, setModel] = useState('auto')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  const lastNodeIdRef = useRef<string | null>(null)

  // ── Load conversation from DB into state ──────────────────────────────────
  const loadConversation = useCallback(
    async (convId: string, name: string) => {
      setActiveConvId(convId)
      setConvName(name)
      setMessages([])
      setSelectedNodeId(null)
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

      // Auto-load the most recent branch as the active chat
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserEmail(user.email ?? '')
      setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'User')

      const res = await fetch('/api/projects')
      if (!res.ok) {
        router.push('/login')
        return
      }
      const { projects } = await res.json()
      if (!projects?.length) return

      setConversations(projects as Conversation[])
      await loadConversation(projects[0].id, projects[0].name)
    }
    init()
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
    const name = `New Conversation`
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return
    const { project } = await res.json()
    setConversations((prev) => [...prev, project])
    await loadConversation(project.id, project.name)
  }, [loadConversation])

  // ── Save a user+assistant node pair after a response ─────────────────────
  const saveNodePair = useCallback(
    async (userContent: string, assistantContent: string) => {
      const pid = activeConvId
      if (!pid) return

      const parentId = lastNodeIdRef.current

      const { data: userNode, error: ue } = await supabase
        .from('nodes')
        .insert({
          project_id: pid,
          parent_id: parentId,
          role: 'user',
          content: userContent,
          position_x: 0,
          position_y: 0,
        })
        .select()
        .single()
      if (ue || !userNode) { console.error('user node save failed', ue); return }

      const { data: asst, error: ae } = await supabase
        .from('nodes')
        .insert({
          project_id: pid,
          parent_id: userNode.id,
          role: 'assistant',
          content: assistantContent,
          position_x: 0,
          position_y: 0,
        })
        .select()
        .single()
      if (ae || !asst) { console.error('assistant node save failed', ae); return }

      lastNodeIdRef.current = asst.id
      setSelectedNodeId(asst.id)
      setAllDbNodes((prev) => [...prev, userNode as DbNode, asst as DbNode])
    },
    [supabase, activeConvId]
  )

  // ── Send a message ────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!input.trim() || isLoading) return

      const userContent = input.trim()
      const now = Date.now()
      const userMsg: ChatMessage = { id: now.toString(), role: 'user', content: userContent, timestamp: now }
      const assistantId = (now + 1).toString()

      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
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

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let full = ''
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            full += decoder.decode(value, { stream: true })
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                id: assistantId,
                role: 'assistant',
                content: full,
                timestamp: Date.now(),
              }
              return updated
            })
          }
        }
        await saveNodePair(userContent, full)
      } catch (err) {
        console.error('Chat error', err)
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, messages, model, saveNodePair]
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
          id: n.id,
          role: n.role,
          content: n.content,
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
    conversations,
    activeConvId,
    convName,
    allDbNodes,
    messages,
    selectedNodeId,
    input,
    setInput,
    isLoading,
    model,
    setModel,
    isSearchOpen,
    setIsSearchOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    handleSend,
    handleNodeClick,
    switchConversation,
    createConversation,
    signOut,
    userEmail,
    userName,
    setUserName,
  }

  return (
    <AppContext.Provider value={ctx}>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
        }}
      >
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <ChatPanel />
        </div>
        <TreePanel />
      </div>
      {isSearchOpen && <SearchModal />}
      {isSettingsOpen && <SettingsModal />}
    </AppContext.Provider>
  )
}
