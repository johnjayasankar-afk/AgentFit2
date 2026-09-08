import type { AssessmentInput } from '../domain/types'
import type { AutonomyResult } from './autonomy'

export type PatternId =
  | 'human-led'
  | 'traditional-automation'
  | 'ai-assist'
  | 'retrieval-assist'
  | 'read-only-tool-agent'
  | 'assistive-tool-agent'
  | 'supervised-tool-agent'
  | 'bounded-execution-agent'

export interface PatternMeta {
  id: PatternId
  name: string
  /** The one-line shape of the system. */
  shape: string
  purpose: string
  boundary: string
  allowed: string[]
  requiresApproval: string[]
  humanRole: string
  whenNotToUse: string
}

export const PATTERNS: Record<PatternId, PatternMeta> = {
  'human-led': {
    id: 'human-led',
    name: 'Human-led process',
    shape: 'No system change — invest in the process instead',
    purpose: 'Keep the work with people, and spend the effort on the conditions that would make delegation possible later.',
    boundary: 'No model in the execution path.',
    allowed: ['Documenting decision rules', 'Instrumenting outcomes', 'Reducing exception volume at source'],
    requiresApproval: [],
    humanRole: 'Performs and owns the work.',
    whenNotToUse: 'When the judgment content is genuinely low and the constraint is only missing tooling.',
  },
  'traditional-automation': {
    id: 'traditional-automation',
    name: 'Deterministic automation',
    shape: 'Rules engine or scheduled job — no generative model',
    purpose: 'Execute an already-specified decision procedure predictably, cheaply, and testably.',
    boundary: 'Deterministic code operating on structured records.',
    allowed: ['Rule evaluation', 'Scheduled execution', 'Structured transformation', 'Threshold alerting'],
    requiresApproval: ['Changes to the rule set itself'],
    humanRole: 'Owns the rules and reviews exceptions the rules reject.',
    whenNotToUse: 'When inputs are unstructured, or the rule set would need hundreds of branches to cover real cases.',
  },
  'ai-assist': {
    id: 'ai-assist',
    name: 'AI assist',
    shape: 'Model in the person’s hands — no system access',
    purpose: 'Help a person read, draft, summarise, or reason faster, without touching any system of record.',
    boundary: 'Model reads what the person supplies and returns text.',
    allowed: ['Drafting', 'Summarising', 'Explaining', 'Comparing options'],
    requiresApproval: ['Everything that leaves the person’s screen'],
    humanRole: 'Performs every step and owns every output.',
    whenNotToUse: 'When the bottleneck is assembling context from systems, not producing text.',
  },
  'retrieval-assist': {
    id: 'retrieval-assist',
    name: 'Retrieval-assisted workflow',
    shape: 'Retrieval → model → person',
    purpose: 'Collapse the context-gathering half of the work so the person spends their time on the decision.',
    boundary: 'Read-only retrieval over known sources; output is a briefing, not an action.',
    allowed: ['Search and retrieval', 'Grounded summarisation', 'Citation of source records'],
    requiresApproval: ['Any write, message, or commitment'],
    humanRole: 'Decides and executes, with the assembly already done.',
    whenNotToUse: 'When the work is a single lookup that a query already answers.',
  },
  'read-only-tool-agent': {
    id: 'read-only-tool-agent',
    name: 'Read-only tool agent',
    shape: 'Agent → read-only tools → recommendation',
    purpose: 'Let the agent investigate across systems and return a reasoned recommendation with its evidence.',
    boundary: 'Tool allowlist containing no mutating calls.',
    allowed: ['Multi-step retrieval', 'Cross-system correlation', 'Recommendation with evidence'],
    requiresApproval: ['Every state change, without exception'],
    humanRole: 'Reviews the recommendation and performs the action.',
    whenNotToUse: 'When reading is trivial and the cost sits entirely in execution.',
  },
  'assistive-tool-agent': {
    id: 'assistive-tool-agent',
    name: 'Assistive tool agent',
    shape: 'Agent → read tools → staged action → person commits',
    purpose: 'Have the agent prepare a complete, executable action that a person inspects and commits.',
    boundary: 'Reads freely inside scope; writes only to a staging area.',
    allowed: ['Investigation', 'Drafting the exact action', 'Pre-flight validation', 'Staging for commit'],
    requiresApproval: ['Every commit to a system of record'],
    humanRole: 'Inspects the prepared action and commits it.',
    whenNotToUse: 'When staging is as expensive as doing, and approval adds nothing but latency.',
  },
  'supervised-tool-agent': {
    id: 'supervised-tool-agent',
    name: 'Supervised tool agent',
    shape: 'Agent → typed tools → policy gate → approval → commit → audit',
    purpose: 'Capture most of the execution value while keeping a person on every consequential boundary.',
    boundary: 'Typed tool allowlist; a policy gate classifies each call as routine or consequential.',
    allowed: ['Planning', 'Read and low-risk write calls', 'Preparing consequential actions', 'Executing after approval'],
    requiresApproval: ['Money movement', 'External communication', 'Irreversible mutation', 'Permission changes'],
    humanRole: 'Approves at the boundary. Does not assemble the case.',
    whenNotToUse: 'When approval latency would erase the benefit and the controls exist to run bounded instead.',
  },
  'bounded-execution-agent': {
    id: 'bounded-execution-agent',
    name: 'Bounded execution agent',
    shape: 'Agent → typed tools → validation → commit → reconciliation → audit',
    purpose: 'Run the workflow independently inside an explicit envelope, escalating anything that falls outside it.',
    boundary: 'Scoped credentials, per-action thresholds, deterministic post-action validation, rollback path.',
    allowed: ['Independent multi-step execution within thresholds', 'Automatic retry and rollback', 'Escalation on any envelope breach'],
    requiresApproval: ['Anything above threshold', 'Anything the validator rejects', 'Changes to the envelope itself'],
    humanRole: 'Sets the envelope, handles escalations, reviews samples and aggregates.',
    whenNotToUse: 'When the envelope cannot be stated precisely — an unstated envelope is not a control.',
  },
}

export interface PatternResult {
  pattern: PatternMeta
  /** Set when workflow decomposition is genuinely indicated. Rarely. */
  decompositionNote: string | null
}

/**
 * Multi-agent decomposition is a response to a real structural problem —
 * distinct context domains that do not fit one working set — not a marker of
 * sophistication. It is surfaced as a note against the chosen pattern rather
 * than as a pattern of its own, because the control requirements are identical.
 */
function decomposition(input: AssessmentInput, autonomy: AutonomyResult): string | null {
  const { structure: s, systems: sys } = input
  const warranted =
    autonomy.level >= 3 &&
    s.contextBreadth === 5 &&
    sys.systemAccess >= 4 &&
    sys.toolingReadiness >= 4 &&
    s.exceptionRate <= 3
  if (!warranted) return null
  return 'Context breadth spans distinct domains that are unlikely to fit one working set. Decomposing retrieval by domain behind a single planning agent is defensible here — decomposing execution is not, because the control surface must stay singular.'
}

export function computePattern(input: AssessmentInput, autonomy: AutonomyResult): PatternResult {
  const { structure: s, systems: sys } = input
  const id: PatternId = (() => {
    if (autonomy.level === 0) {
      return autonomy.zeroVariant === 'human-led' ? 'human-led' : 'traditional-automation'
    }
    if (autonomy.level === 1) {
      return sys.systemAccess >= 3 && s.contextBreadth >= 3 ? 'retrieval-assist' : 'ai-assist'
    }
    if (autonomy.level === 2) {
      return sys.toolingReadiness >= 3 ? 'assistive-tool-agent' : 'read-only-tool-agent'
    }
    if (autonomy.level === 3) return 'supervised-tool-agent'
    return 'bounded-execution-agent'
  })()

  return { pattern: PATTERNS[id], decompositionNote: decomposition(input, autonomy) }
}
