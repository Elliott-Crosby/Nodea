'use client'

// ─── ProjectsLanding — grid of project cards, with empty state ───────────────
// Each card: colored top band + icon tile, name, chat count, last activity,
// and a one-line preview of the most recent chat. Empty state nudges the
// user to create their first project.

import { useState } from 'react'
import { ProjectIcon, colorById } from './projectConstants'
import type { ChatProject } from './chatProjectTypes'
import type { Conversation } from './App'

interface Props {
  projects: ChatProject[]
  conversations: Conversation[]
  dropTarget: string | null
  onOpen: (id: string) => void
  onCreate: () => void
  onContext: (project: ChatProject, x: number, y: number) => void
  onDragOverProject: (projectId: string) => void
  onDragLeaveProject: (projectId: string) => void
  onDropOnProject: (projectId: string, convId: string) => void
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'No activity yet'
  const ts = new Date(iso).getTime()
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const hr  = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (sec < 60) return 'Just now'
  if (min < 60) return `${min}m ago`
  if (hr  < 24) return `${hr}h ago`
  if (day < 7)  return `${day}d ago`
  if (day < 30) return `${Math.floor(day / 7)}w ago`
  return new Date(iso).toLocaleDateString()
}

function previewFor(project: ChatProject, conversations: Conversation[]): string {
  const inProj = conversations
    .filter((c) => c.chat_project_id === project.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return inProj[0]?.name ?? 'No conversations yet'
}

export default function ProjectsLanding({
  projects, conversations, dropTarget,
  onOpen, onCreate, onContext,
  onDragOverProject, onDragLeaveProject, onDropOnProject,
}: Props) {
  if (projects.length === 0) {
    return <EmptyState onCreate={onCreate} />
  }

  return (
    <div data-screen="projects-landing" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 36px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{
              fontSize: 25, fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              marginBottom: 4,
              fontFamily: 'var(--font-bricolage)',
            }}>
              Projects
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
              {projects.length} project{projects.length === 1 ? '' : 's'} ·{' '}
              {projects.filter((p) => p.pinned).length} pinned to sidebar
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 10,
              background: 'var(--accent)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              boxShadow: '0 3px 12px rgba(124,58,237,0.28)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Create project
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              preview={previewFor(p, conversations)}
              dropActive={dropTarget === p.id}
              onOpen={() => onOpen(p.id)}
              onContext={(x, y) => onContext(p, x, y)}
              onDragOver={() => onDragOverProject(p.id)}
              onDragLeave={() => onDragLeaveProject(p.id)}
              onDrop={(convId) => onDropOnProject(p.id, convId)}
            />
          ))}
          <CreateCard onClick={onCreate} />
        </div>
      </div>
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ChatProject
  preview: string
  dropActive: boolean
  onOpen: () => void
  onContext: (x: number, y: number) => void
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (convId: string) => void
}

function ProjectCard({
  project, preview, dropActive,
  onOpen, onContext, onDragOver, onDragLeave, onDrop,
}: ProjectCardProps) {
  const [hover, setHover] = useState(false)
  const c = colorById(project.color)
  const lift = hover ? 'translateY(-2px)' : 'translateY(0)'
  const ring = dropActive
    ? `0 0 0 2px ${c.hex}`
    : (hover ? 'var(--shadow-md)' : 'var(--shadow-sm)')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      onContextMenu={(e) => { e.preventDefault(); onContext(e.clientX, e.clientY) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver() }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        const convId = e.dataTransfer.getData('text/plain')
        if (convId) onDrop(convId)
      }}
      style={{
        borderRadius: 14,
        background: 'var(--ai-card-bg)',
        border: '1px solid var(--ai-card-border)',
        boxShadow: ring,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: lift,
        transition: 'transform 0.14s, box-shadow 0.14s',
        outline: dropActive ? `1.5px dashed ${c.hex}` : 'none',
        outlineOffset: -4,
      }}
    >
      <div style={{ height: 5, background: c.hex }} />
      <div style={{ padding: '15px 16px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: c.soft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ProjectIcon name={project.icon} size={20} color={c.hex} />
          </div>
          {project.pinned && (
            <span title="Pinned to sidebar" style={{ color: c.hex, display: 'inline-flex' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 4h6l-1 6 3 3v2h-5v5l-1 1-1-1v-5H4v-2l3-3z" />
              </svg>
            </span>
          )}
        </div>
        <div>
          <div style={{
            fontSize: 15, fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            marginBottom: 5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {project.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {project.chat_count} chat{project.chat_count === 1 ? '' : 's'}
            </span>
            <span style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: 'var(--text-muted)' }} />
            <span>{formatRelative(project.last_activity)}</span>
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', minWidth: 0 }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
            <path d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {preview}
          </span>
        </div>
      </div>
    </div>
  )
}

function CreateCard({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minHeight: 180,
        borderRadius: 14,
        cursor: 'pointer',
        border: `1.5px dashed ${hover ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: hover ? 'var(--accent-bg)' : 'transparent',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 9,
        color: hover ? 'var(--accent-text)' : 'var(--text-muted)',
        transition: 'all 0.14s',
      }}
    >
      <span style={{
        width: 38, height: 38, borderRadius: '50%',
        background: hover ? 'var(--accent)' : 'var(--bg-muted)',
        color: hover ? '#fff' : 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.14s',
      }}>
        <svg width="16" height="16" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Create project</span>
    </button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div data-screen="projects-empty" style={{
      flex: 1, overflowY: 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40,
    }}>
      <div style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'var(--accent-bg)',
          border: '1px solid var(--user-bubble-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 22px',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="8" height="7" rx="1.5" />
            <rect x="13" y="4" width="8" height="7" rx="1.5" />
            <rect x="3" y="13" width="8" height="7" rx="1.5" />
            <rect x="13" y="13" width="8" height="7" rx="1.5" />
          </svg>
        </div>
        <h2 style={{
          fontSize: 22, fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em', marginBottom: 9,
          fontFamily: 'var(--font-bricolage)',
        }}>
          Organize your conversations
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 24 }}>
          Projects group related chats together — give each one a color and icon, and pin your favorites to the sidebar.
        </p>
        <button
          type="button"
          onClick={onCreate}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 10,
            background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Create your first project
        </button>
      </div>
    </div>
  )
}
