import type { AssessmentInput } from '../domain/types'
import type { AutonomyLevel, AutonomyResult } from './autonomy'

export type ControlId =
  | 'human-approval'
  | 'dual-approval'
  | 'read-only'
  | 'typed-actions'
  | 'tool-allowlist'
  | 'scoped-permissions'
  | 'transaction-limits'
  | 'rate-limits'
  | 'schema-validation'
  | 'pre-action-validation'
  | 'post-action-verification'
  | 'simulation'
  | 'idempotency'
  | 'rollback'
  | 'audit-log'
  | 'exception-escalation'
  | 'timeout'
  | 'reconciliation'
  | 'monitoring'
  | 'data-minimisation'
  | 'confidence-threshold'
  | 'sampled-review'

export interface ControlMeta {
  id: ControlId
  label: string
  /** What it does, in one line, without ceremony. */
  detail: string
}

export const CONTROLS: Record<ControlId, ControlMeta> = {
  'human-approval': { id: 'human-approval', label: 'Human approval', detail: 'A person authorises each consequential action before it commits.' },
  'dual-approval': { id: 'dual-approval', label: 'Dual approval', detail: 'Two people authorise, separating preparation from release.' },
  'read-only': { id: 'read-only', label: 'Read-only access', detail: 'Credentials that cannot mutate state, enforced at the boundary rather than by prompt.' },
  'typed-actions': { id: 'typed-actions', label: 'Typed actions', detail: 'Every action is a named operation with an explicit parameter contract.' },
  'tool-allowlist': { id: 'tool-allowlist', label: 'Tool allowlist', detail: 'The agent may call only enumerated tools; anything else fails closed.' },
  'scoped-permissions': { id: 'scoped-permissions', label: 'Scoped permissions', detail: 'Credentials narrowed to the records and operations this workflow needs.' },
  'transaction-limits': { id: 'transaction-limits', label: 'Transaction limits', detail: 'Per-action and per-period value ceilings above which the case escalates.' },
  'rate-limits': { id: 'rate-limits', label: 'Rate limits', detail: 'A cap on actions per interval, so a systematic error stays small while it is discovered.' },
  'schema-validation': { id: 'schema-validation', label: 'Schema validation', detail: 'Structured output is parsed and rejected on failure, never coerced.' },
  'pre-action-validation': { id: 'pre-action-validation', label: 'Pre-action validation', detail: 'Deterministic checks run against the proposed action before it is executed.' },
  'post-action-verification': { id: 'post-action-verification', label: 'Post-action verification', detail: 'An independent check confirms the intended effect actually occurred.' },
  simulation: { id: 'simulation', label: 'Pre-action simulation', detail: 'The action is executed against a dry-run path and its diff inspected first.' },
  idempotency: { id: 'idempotency', label: 'Idempotency', detail: 'Retries cannot duplicate an effect — every action carries a stable key.' },
  rollback: { id: 'rollback', label: 'Rollback', detail: 'A tested, automated path that reverses a committed action.' },
  'audit-log': { id: 'audit-log', label: 'Audit log', detail: 'An immutable per-case record of inputs, reasoning, tool calls, and outcomes.' },
  'exception-escalation': { id: 'exception-escalation', label: 'Exception escalation', detail: 'A named queue and owner for anything the system declines to handle.' },
  timeout: { id: 'timeout', label: 'Timeout', detail: 'A bounded execution budget after which the case escalates rather than continues.' },
  reconciliation: { id: 'reconciliation', label: 'Reconciliation', detail: 'A periodic sweep comparing system effects against expected state.' },
  monitoring: { id: 'monitoring', label: 'Outcome monitoring', detail: 'Live tracking of error, escalation, and override rates against thresholds.' },
  'data-minimisation': { id: 'data-minimisation', label: 'Data minimisation', detail: 'Only the fields the decision requires enter the context window, with retention bounded.' },
  'confidence-threshold': { id: 'confidence-threshold', label: 'Confidence threshold', detail: 'Cases below a calibrated confidence bar route to a person instead of proceeding.' },
  'sampled-review': { id: 'sampled-review', label: 'Sampled review', detail: 'A fixed share of completed cases is reviewed to detect drift that aggregates hide.' },
}

export interface ControlRequirement {
  control: ControlMeta
  /** Why this workflow needs it. Specific, not generic. */
  because: string
}

export interface ControlPosture {
  /** The single sentence that describes the human boundary. */
  headline: string
  required: ControlRequirement[]
  beforeMoreAutonomy: ControlRequirement[]
  nextLevel: AutonomyLevel | null
}

const c = (id: ControlId, because: string): ControlRequirement => ({ control: CONTROLS[id], because })

/** Controls implied by operating at `level`, given the workflow's characteristics. */
function controlsForLevel(input: AssessmentInput, level: AutonomyLevel): ControlRequirement[] {
  const { structure: s, systems: sys, risk: r, oversight: o } = input
  const out: ControlRequirement[] = []

  if (level === 0) {
    out.push(c('audit-log', 'Even a deterministic path needs a per-case record to diagnose disputes.'))
    out.push(c('exception-escalation', 'The rules will reject cases; someone has to own the queue they land in.'))
    return out
  }

  // Everything above zero.
  out.push(c('audit-log', 'Nothing above assist can be reviewed without a per-case record of what was read and done.'))

  if (level === 1) {
    out.push(c('read-only', 'At this level the model must not be able to reach a system of record at all.'))
    if (r.dataSensitivity >= 3) {
      out.push(c('data-minimisation', 'Sensitive fields should not enter the context window merely because they were nearby.'))
    }
    return out
  }

  if (level === 2) {
    out.push(c('read-only', 'The agent investigates and prepares; the commit path stays with a person.'))
    out.push(c('tool-allowlist', 'Read tools must be enumerated so scope creep is a code change, not a prompt change.'))
    out.push(c('schema-validation', 'Prepared actions must parse against a contract before a person is asked to trust them.'))
    if (r.dataSensitivity >= 3) {
      out.push(c('data-minimisation', 'Retrieval breadth is the point of this pattern, which makes field-level restraint the control.'))
    }
    if (o.escalationAvailability <= 3) {
      out.push(c('exception-escalation', 'Cases the agent cannot prepare need a named owner rather than a silent drop.'))
    }
    return out
  }

  // Level 3+ can execute.
  out.push(c('typed-actions', 'Execution must go through named operations with explicit parameters, not free-form calls.'))
  out.push(c('tool-allowlist', 'The set of things the agent can do is a security boundary and belongs in code.'))
  out.push(c('scoped-permissions', 'Credentials should permit this workflow and nothing adjacent to it.'))
  out.push(c('pre-action-validation', 'Deterministic checks belong in front of the commit, not in the prompt.'))
  out.push(c('idempotency', 'Retries are inevitable in multi-step execution; duplicated effects must be impossible.'))
  out.push(c('exception-escalation', 'Anything the agent declines has to reach a person who can finish it.'))
  out.push(c('timeout', 'A stuck plan must stop and escalate rather than continue spending.'))

  if (level === 3) {
    out.push(c('human-approval', 'Approval at the consequential boundary is what distinguishes this level from bounded execution.'))
  }

  if (level >= 4) {
    out.push(c('post-action-verification', 'Without a person at the boundary, an automated check is the only thing confirming the effect.'))
    out.push(c('rollback', 'Independent execution requires a tested reversal path, not a manual recovery runbook.'))
    out.push(c('transaction-limits', 'The envelope must be numeric: a stated ceiling above which the case escalates.'))
    out.push(c('rate-limits', 'A systematic error should stay small during the window in which it is discovered.'))
    out.push(c('reconciliation', 'A periodic sweep catches the class of error that per-case checks are blind to.'))
    out.push(c('monitoring', 'Aggregate error and escalation rates replace per-case review, so they must be watched.'))
    out.push(c('sampled-review', 'Aggregates hide drift; a fixed sample of completed cases is how you see it.'))
  }

  if (level === 5) {
    out.push(c('confidence-threshold', 'With no synchronous oversight, the system must decline its own uncertain cases.'))
  }

  /* --- characteristic-driven additions -------------------------- */
  if (r.reversibility <= 2 && level >= 3) {
    out.push(c('simulation', 'Actions this hard to undo should be inspected as a diff before they commit.'))
  }
  if (r.failureConsequence >= 4 && level >= 3) {
    out.push(c('transaction-limits', 'Serious consequence needs a numeric ceiling, not only an approver’s attention.'))
  }
  if (r.failureConsequence >= 5 && level >= 3) {
    out.push(c('dual-approval', 'At this consequence level, preparation and release should not be the same person.'))
  }
  if (r.blastRadius >= 4) {
    out.push(c('rate-limits', 'A wide radius means the cost of an error scales with how fast the system runs.'))
    if (level >= 3) out.push(c('reconciliation', 'Systemic reach requires a sweep that detects effects the per-case check missed.'))
  }
  if (sys.permissionComplexity >= 4) {
    out.push(c('scoped-permissions', 'Privileged access is the dominant risk here and should be narrowed before anything else.'))
  }
  if (r.dataSensitivity >= 4) {
    out.push(c('data-minimisation', 'Restricted data constrains what may enter context and how long it may persist.'))
  }
  if (r.regulatorySensitivity >= 4 && level >= 2) {
    out.push(c('human-approval', 'An accountable signatory is required by rule, independently of measured performance.'))
  }
  if (sys.verification <= 2 && level >= 3) {
    out.push(c('confidence-threshold', 'Where correctness is hard to check, the system should route its uncertain cases out.'))
  }
  if (s.exceptionRate >= 4) {
    out.push(c('exception-escalation', 'With exceptions this frequent, the escalation path carries most of the volume.'))
  }
  if (o.reviewCost >= 4 && level === 3) {
    out.push(c('simulation', 'Expensive review needs a diff to review, or the approval gate becomes a rubber stamp.'))
  }

  return out
}

function dedupe(list: ControlRequirement[]): ControlRequirement[] {
  const seen = new Map<ControlId, ControlRequirement>()
  for (const item of list) {
    if (!seen.has(item.control.id)) seen.set(item.control.id, item)
  }
  return [...seen.values()]
}

export function computeControls(input: AssessmentInput, autonomy: AutonomyResult): ControlPosture {
  const required = dedupe(controlsForLevel(input, autonomy.level))
  const next = autonomy.level < 5 ? ((autonomy.level + 1) as AutonomyLevel) : null

  const beforeMore = next === null
    ? []
    : dedupe(controlsForLevel(input, next)).filter(
        (r) => !required.some((existing) => existing.control.id === r.control.id),
      )

  return {
    headline: headlineFor(input, autonomy),
    required,
    beforeMoreAutonomy: beforeMore,
    nextLevel: next,
  }
}

function headlineFor(input: AssessmentInput, autonomy: AutonomyResult): string {
  switch (autonomy.level) {
    case 0:
      return autonomy.zeroVariant === 'human-led'
        ? 'The decision stays with a person'
        : 'Deterministic rules, with a queue for what they reject'
    case 1:
      return 'No system access — the model advises, the person acts'
    case 2:
      return 'Read-only execution; every commit stays with a person'
    case 3:
      return input.risk.failureConsequence >= 5
        ? 'Dual approval before irreversible or high-consequence action'
        : 'Human approval before consequential action'
    case 4:
      return 'Independent execution inside a stated envelope; breaches escalate'
    case 5:
      return 'Aggregate oversight, with the system declining its own uncertain cases'
  }
}
