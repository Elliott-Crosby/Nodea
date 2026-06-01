// ─── Shared constants for the Projects feature ───────────────────────────────
// Curated icon set + color palette. The colors are the exact Nodea node-tree
// palette (ROYGBIV) so a project color reads as "the same language" as a
// colored node in the tree. The icon glyphs use the same line-style we use
// elsewhere in the sidebar.

import type { CSSProperties } from 'react'

export interface ProjectColor {
  id: string
  hex: string
  soft: string
  label: string
}

export const PROJECT_COLORS: ProjectColor[] = [
  { id: 'red',    hex: '#ef4444', soft: 'rgba(239,68,68,0.12)',  label: 'Red'    },
  { id: 'orange', hex: '#f97316', soft: 'rgba(249,115,22,0.12)', label: 'Orange' },
  { id: 'yellow', hex: '#eab308', soft: 'rgba(234,179,8,0.14)',  label: 'Yellow' },
  { id: 'green',  hex: '#22c55e', soft: 'rgba(34,197,94,0.12)',  label: 'Green'  },
  { id: 'blue',   hex: '#3b82f6', soft: 'rgba(59,130,246,0.12)', label: 'Blue'   },
  { id: 'indigo', hex: '#6366f1', soft: 'rgba(99,102,241,0.12)', label: 'Indigo' },
  { id: 'violet', hex: '#8b5cf6', soft: 'rgba(139,92,246,0.13)', label: 'Violet' },
]

export const DEFAULT_COLOR_ID = 'violet'

export function colorById(id: string | null | undefined): ProjectColor {
  return PROJECT_COLORS.find((c) => c.id === id) || PROJECT_COLORS[6] // violet fallback
}

// ── Icon set ─────────────────────────────────────────────────────────────────
// stroke = currentColor; viewBox 0 0 24 24; strokeWidth 1.7, round caps.
// Mix of work/object metaphors + abstract symbols. Curated set (no free-form).
export const ICON_PATHS: Record<string, string> = {
  compass:   '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  book:      '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 0 20 17.5z"/>',
  code:      '<path d="M9 8l-4 4 4 4"/><path d="M15 8l4 4-4 4"/>',
  flask:     '<path d="M9 3h6"/><path d="M10 3v5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8V3"/><path d="M7.5 14h9"/>',
  bulb:      '<path d="M9 16.5a5 5 0 1 1 6 0V18a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/><path d="M9.5 21.5h5"/>',
  rocket:    '<path d="M12 3c3 1.5 5 5 5 9l-3 2.5h-4L7 12c0-4 2-7.5 5-9z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M9 16l-2 4 3-1M15 16l2 4-3-1"/>',
  target:    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
  briefcase: '<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M3.5 12h17"/>',
  cap:       '<path d="M12 4l9 4.5-9 4.5-9-4.5z"/><path d="M6 10.5V15c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-4.5"/>',
  chart:     '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16l3.5-4 3 2.5L20 8"/>',
  feather:   '<path d="M19 5c-4 0-9 2-12 6l-2 8 8-2c4-3 6-8 6-12z"/><path d="M5 19l7-7"/>',
  layers:    '<path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5"/><path d="M4 16.5L12 21l8-4.5"/>',
  sparkle:   '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 16.5l.7 2 .7-2 2-.7-2-.7-.7-2-.7 2-2 .7z"/>',
  hexagon:   '<path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z"/>',
  atom:      '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  cube:      '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5"/><path d="M12 12v9"/>',
  leaf:      '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19c4-4 7-7 10-9"/>',
  bolt:      '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  globe:     '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17"/>',
  chat:      '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6z"/>',
}

export const ICON_KEYS = Object.keys(ICON_PATHS)
export const DEFAULT_ICON = 'sparkle'

export function isValidIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, name)
}

export function isValidColor(id: string): boolean {
  return PROJECT_COLORS.some((c) => c.id === id)
}

// ── ProjectIcon — small SVG renderer ────────────────────────────────────────
interface ProjectIconProps {
  name: string
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
}

export function ProjectIcon({
  name,
  size = 18,
  color = 'currentColor',
  strokeWidth = 1.7,
  style,
}: ProjectIconProps) {
  const inner = ICON_PATHS[name] || ICON_PATHS.hexagon
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

// ── Limits ──────────────────────────────────────────────────────────────────
export const MAX_PINNED_PROJECTS = 3
export const MAX_NAME_LENGTH = 80
export const MAX_DESCRIPTION_LENGTH = 280
// Project memory is longer-form context (injected into the system prompt for
// the project's chats), so it gets a more generous cap than the description.
export const MAX_PROJECT_MEMORY_LENGTH = 2000
