'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface DbNode {
  id: string
  project_id: string
  parent_id: string | null
  role: 'user' | 'assistant'
  content: string
  position_x: number
  position_y: number
  created_at: string
}

function truncate(str: string, max = 120) {
  return str.length <= max ? str : str.slice(0, max) + '…'
}

const userNodeStyle: React.CSSProperties = {
  background: '#1a1f2e',
  color: '#fff',
  border: '1px solid #3b82f6',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '11px',
  width: '200px',
  cursor: 'pointer',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const assistantNodeStyle: React.CSSProperties = {
  background: '#111827',
  color: '#fff',
  border: '1px solid #6366f1',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '11px',
  width: '200px',
  cursor: 'pointer',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

/**
 * Leaf-counting tree layout (Reingold-Tilford style).
 * X = leafIndex * 260 for leaves; average of children for internal nodes.
 * Y = depth * 120.
 * Pure function — does not write back to Supabase.
 */
function computeLayout(dbNodes: DbNode[]): Map<string, { x: number; y: number }> {
  // Build parent_id → children map, sorted by created_at ascending
  const childrenMap = new Map<string | null, DbNode[]>()
  for (const node of dbNodes) {
    const key = node.parent_id ?? null
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key)!.push(node)
  }
  for (const children of childrenMap.values()) {
    children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  const positions = new Map<string, { x: number; y: number }>()
  let leafCounter = 0

  function walk(nodeId: string, depth: number): number {
    const children = childrenMap.get(nodeId) ?? []
    if (children.length === 0) {
      // Leaf node — assign next slot
      const x = leafCounter * 260
      leafCounter++
      positions.set(nodeId, { x, y: depth * 120 })
      return x
    }
    // Internal node — recurse first, then centre over children
    const childXs: number[] = []
    for (const child of children) {
      childXs.push(walk(child.id, depth + 1))
    }
    const x = (childXs[0] + childXs[childXs.length - 1]) / 2
    positions.set(nodeId, { x, y: depth * 120 })
    return x
  }

  // Start from all root nodes (parent_id === null)
  const roots = childrenMap.get(null) ?? []
  for (const root of roots) {
    walk(root.id, 0)
  }

  return positions
}

// ─── Inner component — requires ReactFlowProvider ancestor ───────────────────

function AppInner() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { fitView } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [projectName, setProjectName] = useState('Loading...')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const projectIdRef = useRef<string | null>(null)
  const lastNodeIdRef = useRef<string | null>(null)
  const allDbNodesRef = useRef<DbNode[]>([])  // mirrors full DB node list; drives computeLayout
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load project + existing nodes on mount
  useEffect(() => {
    async function init() {
      const res = await fetch('/api/projects')
      if (!res.ok) {
        router.push('/login')
        return
      }

      const { project } = await res.json()
      if (!project) return

      projectIdRef.current = project.id
      setProjectName(project.name)

      const { data: dbNodes, error } = await supabase
        .from('nodes')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true })

      if (error || !dbNodes?.length) return

      allDbNodesRef.current = dbNodes as DbNode[]
      const positions = computeLayout(dbNodes as DbNode[])

      const rfNodes: Node[] = (dbNodes as DbNode[]).map((n) => ({
        id: n.id,
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: { label: truncate(n.content) },
        style: n.role === 'user' ? userNodeStyle : assistantNodeStyle,
      }))

      const rfEdges: Edge[] = (dbNodes as DbNode[])
        .filter((n) => n.parent_id)
        .map((n) => ({
          id: `e-${n.parent_id}-${n.id}`,
          source: n.parent_id!,
          target: n.id,
          style: { stroke: '#444' },
        }))

      setNodes(rfNodes)
      setEdges(rfEdges)

      const assistantNodes = (dbNodes as DbNode[]).filter((n) => n.role === 'assistant')
      if (assistantNodes.length) {
        lastNodeIdRef.current = assistantNodes[assistantNodes.length - 1].id
      }

      setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 50)
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveNodePair = useCallback(
    async (userContent: string, assistantContent: string) => {
      const pid = projectIdRef.current
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

      if (ue || !userNode) {
        console.error('Failed to save user node', ue)
        return
      }

      const { data: assistantNode, error: ae } = await supabase
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

      if (ae || !assistantNode) {
        console.error('Failed to save assistant node', ae)
        return
      }

      lastNodeIdRef.current = assistantNode.id

      // Update the full DB node mirror and recompute layout over everything
      const updatedDbNodes: DbNode[] = [
        ...allDbNodesRef.current,
        userNode as DbNode,
        assistantNode as DbNode,
      ]
      allDbNodesRef.current = updatedDbNodes
      const positions = computeLayout(updatedDbNodes)

      const newRfNodes: Node[] = [
        {
          id: userNode.id,
          position: positions.get(userNode.id) ?? { x: 0, y: 0 },
          data: { label: truncate(userContent) },
          style: userNodeStyle,
        },
        {
          id: assistantNode.id,
          position: positions.get(assistantNode.id) ?? { x: 0, y: 0 },
          data: { label: truncate(assistantContent) },
          style: assistantNodeStyle,
        },
      ]

      const newEdges: Edge[] = []
      if (parentId) {
        newEdges.push({
          id: `e-${parentId}-${userNode.id}`,
          source: parentId,
          target: userNode.id,
          style: { stroke: '#444' },
        })
      }
      newEdges.push({
        id: `e-${userNode.id}-${assistantNode.id}`,
        source: userNode.id,
        target: assistantNode.id,
        style: { stroke: '#444' },
      })

      // Append new nodes then re-apply all positions from the updated layout
      setNodes((prev) =>
        [...prev, ...newRfNodes].map((n) => ({
          ...n,
          position: positions.get(n.id) ?? n.position,
        }))
      )
      setEdges((prev) => [...prev, ...newEdges])

      setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 50)
    },
    [supabase, fitView]
  )

  const onNodeClick = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      const pid = projectIdRef.current
      if (!pid) return

      const { data: allNodes } = await supabase.from('nodes').select('*').eq('project_id', pid)
      if (!allNodes) return

      // Fix 2: refresh allDbNodesRef from live data so saveNodePair layout is accurate
      allDbNodesRef.current = allNodes as DbNode[]

      const nodeMap = new Map<string, DbNode>((allNodes as DbNode[]).map((n) => [n.id, n]))

      const chain: DbNode[] = []
      let current: DbNode | undefined = nodeMap.get(node.id)
      while (current) {
        chain.unshift(current)
        current = current.parent_id ? nodeMap.get(current.parent_id) : undefined
      }

      setMessages(chain.map((n) => ({ id: n.id, role: n.role, content: n.content })))

      const lastAssistant = [...chain].reverse().find((n) => n.role === 'assistant')
      if (lastAssistant) lastNodeIdRef.current = lastAssistant.id
    },
    [supabase]
  )

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleSend = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!input.trim() || isLoading) return

      const userContent = input.trim()
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userContent }
      const assistantId = (Date.now() + 1).toString()

      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setIsLoading(true)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages }),
        })

        if (!response.ok) throw new Error('Chat request failed')

        setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const text = decoder.decode(value, { stream: true })
            fullContent += text
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = { id: assistantId, role: 'assistant', content: fullContent }
              return updated
            })
          }
        }

        await saveNodePair(userContent, fullContent)
      } catch (err) {
        console.error('Chat error', err)
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, messages, saveNodePair]
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a' }}>
      {/* Chat panel — 40% */}
      <div
        style={{
          width: '40%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #222',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #222',
            background: '#111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{projectName}</span>
          <button
            onClick={handleSignOut}
            style={{ background: 'none', border: 'none', fontSize: '12px', color: '#666', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#444',
                fontSize: '13px',
                textAlign: 'center',
                gap: '6px',
              }}
            >
              <span>Start a conversation.</span>
              <span style={{ fontSize: '12px', color: '#333' }}>
                Click a canvas node to branch from that point.
              </span>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  background: message.role === 'user' ? '#1a1f2e' : '#111',
                  color: '#fff',
                  border: message.role === 'user' ? '1px solid #3b82f630' : '1px solid #222',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  background: '#111',
                  color: '#555',
                  border: '1px solid #222',
                }}
              >
                Thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #222',
            background: '#111',
            flexShrink: 0,
          }}
        >
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#fff',
                background: '#1a1a1a',
                border: '1px solid #333',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#000',
                background: '#fff',
                border: 'none',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !input.trim() ? 0.4 : 1,
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Canvas panel — 60% */}
      <div style={{ width: '60%', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          colorMode="dark"
          style={{ background: '#0a0a0a' }}
        >
          <Background color="#1a1a1a" gap={24} variant={BackgroundVariant.Dots} />
          <Controls />
        </ReactFlow>

        {nodes.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              color: '#2a2a2a',
              fontSize: '13px',
            }}
          >
            Nodes will appear here as you chat
          </div>
        )}
      </div>
    </div>
  )
}

// Wrap with ReactFlowProvider so AppInner can call useReactFlow()
export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}
