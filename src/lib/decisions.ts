// Decision-making layer — shared vocabulary (Chat Project decision tags).
//
// In a branching canvas a decision is already structural: a node with several
// children is a decision point, each child branch is an option, the kept path
// is the choice, and abandoned branches are the rejected/dead alternatives.
// A `decision_status` tag (Tier A — the substrate) names where a node sits in
// that picture. Tags live on the *user* node of a pair (the branch the user
// took). The canvas lens, the project ledger, and the Haiku copilot all read
// this same vocabulary, so it lives here as the single source of truth.
//
// The key semantic split worth preserving everywhere:
//   • `rejected` — considered and deliberately ruled out (carries a "why").
//   • `dead`     — abandoned dead-end; fizzled or obsolete, not a deliberate no.
// The copilot treats those very differently.

export type DecisionStatus =
  | 'undecided'    // an open decision lives here (marks a fork that needs resolving)
  | 'considering'  // actively weighing this branch — in play
  | 'decided'      // chosen / committed — the kept path
  | 'rejected'     // considered and explicitly ruled out
  | 'dead'         // abandoned dead-end — fizzled or obsolete
  | 'later'        // parked; revisit, not now

/** The current decision tag on a node, as held in client state. */
export interface NodeDecision {
  status: DecisionStatus
  note?: string | null
}

export interface DecisionMeta {
  id: DecisionStatus
  label: string
  color: string
  /** 'open' = still needs a human; 'resolved' = settled either way. */
  group: 'open' | 'resolved'
  /** 'question' tags a fork/open loop; 'option' tags a path. */
  level: 'question' | 'option'
  description: string
}

// Order matters: this is the order chips render in the menu and rows group in
// the ledger (open first, then the resolved outcomes).
export const DECISION_STATUSES: DecisionMeta[] = [
  { id: 'undecided',   label: 'Undecided',   color: '#f59e0b', group: 'open',     level: 'question', description: 'An open decision lives here — a fork that still needs resolving.' },
  { id: 'considering', label: 'Considering', color: '#3b82f6', group: 'open',     level: 'option',   description: 'Actively weighing this branch. Still in play.' },
  { id: 'decided',     label: 'Decided',     color: '#22c55e', group: 'resolved', level: 'option',   description: 'Chosen and committed — the kept path.' },
  { id: 'rejected',    label: 'Rejected',    color: '#ef4444', group: 'resolved', level: 'option',   description: 'Considered and deliberately ruled out (note the why).' },
  { id: 'dead',        label: 'Dead end',    color: '#94a3b8', group: 'resolved', level: 'option',   description: 'Abandoned — fizzled or obsolete, not a deliberate no.' },
  { id: 'later',       label: 'Later',       color: '#8b5cf6', group: 'open',     level: 'option',   description: 'Parked. Revisit later, not now.' },
]

const DECISION_BY_ID: Record<DecisionStatus, DecisionMeta> = Object.fromEntries(
  DECISION_STATUSES.map((d) => [d.id, d]),
) as Record<DecisionStatus, DecisionMeta>

export function decisionMeta(status: DecisionStatus): DecisionMeta {
  return DECISION_BY_ID[status]
}

export function isDecisionStatus(v: unknown): v is DecisionStatus {
  return typeof v === 'string' && v in DECISION_BY_ID
}
