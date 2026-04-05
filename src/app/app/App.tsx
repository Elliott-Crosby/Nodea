'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useChat } from 'ai/react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface DbNode {
  id: string
  project_id: string
  parent_id: string | null
  role: 'user' | 'assistant'
  content: string
  position_x: number
  position_y: number
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

export default function App() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [projectName, setProjectName] = useState('Loading...')

  const projectIdRef = useRef<string | null>(null)
  const lastNodeIdRef = useRef<string | null>(null)
  const pendingUserMsgRef = useRef('')
  const nodeCountRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat',
    onFinish: async (assistantMessage) => {
      const pid = projectIdRef.current
      const userContent = pendingUserMsgRef.current
      if (!pid || !userContent) return

      const parentId = lastNodeIdRef.current
      const userY = nodeCountRef.current * 130 + 20
      nodeCountRef.current++
      const assistantY = nodeCountRef.current * 130 + 20
      nodeCountRef.current++

      const { data: userNode, error: ue } = await supabase
        .from('nodes')
        .insert({
          project_id: pid,
          parent_id: parentId,
          role: 'user',
          content: userContent,
          position_x: 100,
          position_y: userY,
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
          content: assistantMessage.content,
          position_x: 300,
          position_y: assistantY,
        })
        .select()
        .single()

      if (ae || !assistantNode) {
        console.error('Failed to save assistant node', ae)
        return
      }

      lastNodeIdRef.current = assistantNode.id

      const newNodes: Node[] = [
        {
          id: userNode.id,
          position: { x: 100, y: userY },
          data: { label: truncate(userContent) },
          style: userNodeStyle,
        },
        {
          id: assistantNode.id,
          position: { x: 300, y: assistantY },
          data: { label: truncate(assistantMessage.content) },
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

      setNodes((prev) => [...prev, ...newNodes])
      setEdges((prev) => [...prev, ...newEdges])
    },
  })

  // Scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load project and existing nodes on mount
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

      const rfNodes: Node[] = (dbNodes as DbNode[]).map((n) => ({
        id: n.id,
        position: { x: n.position_x, y: n.position_y },
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
      nodeCountRef.current = dbNodes.length
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!input.trim() || isLoading) return
      pendingUserMsgRef.current = input.trim()
      handleSubmit(e)
    },
    [input, isLoading, handleSubmit]
  )

  const onNodeClick = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      const pid = projectIdRef.current
      if (!pid) return

      const { data: allNodes } = await supabase
        .from('nodes')
        .select('*')
        .eq('project_id', pid)

      if (!allNodes) return

      const nodeMap = new Map<string, DbNode>(
        (allNodes as DbNode[]).map((n) => [n.id, n])
      )

      const chain: DbNode[] = []
      let current: DbNode | undefined = nodeMap.get(node.id)
      while (current) {
        chain.unshift(current)
        current = current.parent_id ? nodeMap.get(current.parent_id) : undefined
      }

      setMessages(
        chain.map((n) => ({
          id: n.id,
          role: n.role as 'user' | 'assistant',
          content: n.content,
        }))
      )

      const lastAssistant = [...chain].reverse().find((n) => n.role === 'assistant')
      if (lastAssistant) {
        lastNodeIdRef.current = lastAssistant.id
      }
    },
    [setMessages, supabase]
  )

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a' }}>
      {/* Chat panel */}
      <div
        style={{
          width: '50%',
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
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
            {projectName}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12px',
              color: '#666',
              cursor: 'pointer',
            }}
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
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
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

          {isLoading && (
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
              onChange={handleInputChange}
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

      {/* Canvas panel */}
      <div style={{ width: '50%', position: 'relative' }}>
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
