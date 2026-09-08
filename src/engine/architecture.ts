import type { PatternId } from './pattern'

export type NodeKind = 'source' | 'process' | 'control' | 'commit' | 'human'

export interface ArchNode {
  label: string
  detail: string
  kind: NodeKind
}

/**
 * The reference shape for each pattern, as a linear flow. Control and human
 * steps are marked so the diagram can show where the boundary sits without a
 * legend — the boundary is the point of the drawing.
 */
const FLOWS: Record<PatternId, ArchNode[]> = {
  'human-led': [
    { label: 'Case', detail: 'arrives as today', kind: 'source' },
    { label: 'Practitioner', detail: 'reads, decides, acts', kind: 'human' },
    { label: 'Outcome capture', detail: 'decision and reasoning recorded', kind: 'control' },
    { label: 'Rule extraction', detail: 'resolved cases become a written standard', kind: 'process' },
  ],
  'traditional-automation': [
    { label: 'Trigger', detail: 'event or schedule', kind: 'source' },
    { label: 'Rules engine', detail: 'deterministic evaluation', kind: 'process' },
    { label: 'Schema validation', detail: 'reject rather than coerce', kind: 'control' },
    { label: 'Commit', detail: 'system of record', kind: 'commit' },
    { label: 'Exception queue', detail: 'what the rules decline', kind: 'human' },
    { label: 'Audit log', detail: 'per-case record', kind: 'control' },
  ],
  'ai-assist': [
    { label: 'Practitioner', detail: 'supplies the material', kind: 'human' },
    { label: 'Model', detail: 'drafts, summarises, explains', kind: 'process' },
    { label: 'Practitioner', detail: 'edits, decides, executes', kind: 'human' },
  ],
  'retrieval-assist': [
    { label: 'Case', detail: 'opened by a practitioner', kind: 'source' },
    { label: 'Retrieval', detail: 'read-only over known sources', kind: 'process' },
    { label: 'Model', detail: 'grounded briefing with citations', kind: 'process' },
    { label: 'Practitioner', detail: 'decides and executes', kind: 'human' },
  ],
  'read-only-tool-agent': [
    { label: 'Case', detail: 'routed to the agent', kind: 'source' },
    { label: 'Agent', detail: 'plans its own investigation', kind: 'process' },
    { label: 'Read-only tools', detail: 'allowlist with no mutating calls', kind: 'control' },
    { label: 'Recommendation', detail: 'with evidence per claim', kind: 'process' },
    { label: 'Practitioner', detail: 'reviews and executes', kind: 'human' },
    { label: 'Audit log', detail: 'context, calls, reasoning', kind: 'control' },
  ],
  'assistive-tool-agent': [
    { label: 'Case', detail: 'routed to the agent', kind: 'source' },
    { label: 'Agent', detail: 'investigates and prepares', kind: 'process' },
    { label: 'Read tools', detail: 'scoped allowlist', kind: 'control' },
    { label: 'Staged action', detail: 'exact change, not a description', kind: 'process' },
    { label: 'Pre-flight validation', detail: 'deterministic checks on the draft', kind: 'control' },
    { label: 'Practitioner', detail: 'inspects and commits', kind: 'human' },
    { label: 'Audit log', detail: 'per-case trace', kind: 'control' },
  ],
  'supervised-tool-agent': [
    { label: 'Trigger', detail: 'event or queue', kind: 'source' },
    { label: 'Context retrieval', detail: 'scoped, cited', kind: 'process' },
    { label: 'Agent', detail: 'plans over typed tools', kind: 'process' },
    { label: 'Policy gate', detail: 'routine or consequential', kind: 'control' },
    { label: 'Approval', detail: 'named human at the boundary', kind: 'human' },
    { label: 'Typed tool', detail: 'bounded parameters', kind: 'control' },
    { label: 'Validation', detail: 'pre-action checks', kind: 'control' },
    { label: 'Commit', detail: 'idempotent write', kind: 'commit' },
    { label: 'Audit log', detail: 'inputs, calls, approver, outcome', kind: 'control' },
  ],
  'bounded-execution-agent': [
    { label: 'Trigger', detail: 'event or queue', kind: 'source' },
    { label: 'Context retrieval', detail: 'scoped, cited', kind: 'process' },
    { label: 'Agent', detail: 'plans over typed tools', kind: 'process' },
    { label: 'Envelope check', detail: 'thresholds, rate, scope', kind: 'control' },
    { label: 'Typed tool', detail: 'bounded parameters', kind: 'control' },
    { label: 'Commit', detail: 'idempotent write', kind: 'commit' },
    { label: 'Post-verification', detail: 'confirm the effect occurred', kind: 'control' },
    { label: 'Rollback', detail: 'on failed verification', kind: 'control' },
    { label: 'Escalation', detail: 'every envelope breach', kind: 'human' },
    { label: 'Reconciliation', detail: 'scheduled sweep', kind: 'control' },
    { label: 'Audit log', detail: 'per-case trace', kind: 'control' },
  ],
}

export function computeArchitecture(pattern: PatternId): ArchNode[] {
  return FLOWS[pattern]
}
