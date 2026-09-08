import type { AssessmentInput, DimensionKey, Score } from '../domain/types'
import { DIMENSION_BY_KEY, readDimension } from '../domain/dimensions'
import { aiNecessity, clamp01 } from './normalize'
import type { FitResult } from './fit'

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface AutonomyLevelMeta {
  level: AutonomyLevel
  name: string
  short: string
  /** What the system is permitted to do. */
  definition: string
  /** Where the human sits. */
  humanRole: string
}

export const AUTONOMY_LADDER: readonly AutonomyLevelMeta[] = [
  {
    level: 0,
    name: 'Conventional / human-led',
    short: 'Conventional',
    definition: 'No generative model required. The work is either deterministic enough for ordinary software or too dependent on human judgment to delegate.',
    humanRole: 'Owns the work, or owns the rules that execute it.',
  },
  {
    level: 1,
    name: 'Assist',
    short: 'Assist',
    definition: 'A model helps a person read, draft, or reason. It takes no action in any system of record.',
    humanRole: 'Performs every step and owns every output.',
  },
  {
    level: 2,
    name: 'Assistive agent',
    short: 'Assistive',
    definition: 'The agent gathers context, reasons over it, performs read-only tool calls, and prepares work for a person to execute.',
    humanRole: 'Decides and executes. The agent does the assembly.',
  },
  {
    level: 3,
    name: 'Supervised agent',
    short: 'Supervised',
    definition: 'The agent plans and executes multi-step work through typed tools, and stops for approval at every consequential boundary.',
    humanRole: 'Approves consequential actions. Does not do the assembly.',
  },
  {
    level: 4,
    name: 'Bounded agent',
    short: 'Bounded',
    definition: 'The agent executes independently inside explicit permissions, thresholds, validation and rollback. Anything outside the envelope escalates.',
    humanRole: 'Sets the envelope, handles escalations, reviews samples.',
  },
  {
    level: 5,
    name: 'Autonomous',
    short: 'Autonomous',
    definition: 'The agent pursues the objective across steps with minimal synchronous oversight. Reserved for work that is cheap to get wrong and trivial to undo.',
    humanRole: 'Monitors aggregate outcomes rather than individual cases.',
  },
]

export const AUTONOMY_BY_LEVEL = Object.fromEntries(
  AUTONOMY_LADDER.map((l) => [l.level, l]),
) as Record<AutonomyLevel, AutonomyLevelMeta>

/* ------------------------------------------------------------------ *
 * Gates
 * ------------------------------------------------------------------ */

export interface Requirement {
  key: DimensionKey
  op: '>=' | '<='
  value: number
}

export interface Gate {
  id: string
  /** The highest level this gate permits while it is unmet. */
  cap: AutonomyLevel
  title: string
  /** Why this constraint exists. One sentence, plain. */
  detail: string
  /** The gate is only active in this context. Absent means always active. */
  when?: (i: AssessmentInput) => boolean
  /** All must hold for the gate to be cleared. */
  requirements: Requirement[]
}

const g = (
  id: string,
  cap: AutonomyLevel,
  title: string,
  detail: string,
  requirements: Requirement[],
  when?: (i: AssessmentInput) => boolean,
): Gate => ({ id, cap, title, detail, requirements, ...(when ? { when } : {}) })

const req = (key: DimensionKey, op: '>=' | '<=', value: number): Requirement => ({ key, op, value })

/**
 * Autonomy gates, in the order they are reported.
 *
 * Each gate names a condition under which independent action is not yet
 * defensible, and the level it permits until that condition is met. The final
 * recommendation is the minimum of every active cap and the readiness-derived
 * ceiling — a single unmet gate is enough to hold autonomy down, regardless of
 * how strong every other signal is. That asymmetry is deliberate.
 */
export const GATES: readonly Gate[] = [
  /* --- ability to act at all ------------------------------------ */
  g('access-none', 1, 'No programmatic access to context',
    'Without machine-readable access to the case and its surroundings there is nothing for an agent to operate on.',
    [req('systems.systemAccess', '>=', 3)]),
  g('access-partial', 2, 'Access is incomplete',
    'Partial coverage means the agent can assemble a view but cannot be trusted to act on it unattended.',
    [req('systems.systemAccess', '>=', 4)]),
  g('tooling-none', 2, 'No stable interfaces to act through',
    'Brittle or absent tooling turns every write into an unbounded action.',
    [req('systems.toolingReadiness', '>=', 3)]),
  g('tooling-typed', 3, 'Actions are not typed',
    'Independent execution requires actions with explicit contracts and bounded parameters.',
    [req('systems.toolingReadiness', '>=', 4)]),

  /* --- judgment -------------------------------------------------- */
  g('judgment-irreducible', 1, 'Expert judgment is the deliverable',
    'Where the judgment is the product, automating around it removes the thing of value.',
    [req('structure.humanJudgment', '<=', 4)]),
  g('judgment-expert', 2, 'Substantial expertise is irreducible',
    'A person must remain the decision-maker when the decision depends on expertise the system does not hold.',
    [req('structure.humanJudgment', '<=', 3)]),

  /* --- knowing whether it worked --------------------------------- */
  g('verification-unreviewable', 2, 'Correctness cannot be established at reasonable cost',
    'If neither the system nor a reviewer can tell whether an output is right, an approval gate is theatre.',
    [req('systems.verification', '>=', 3)],
    (i) => i.systems.verification <= 2 && i.oversight.reviewCost >= 4),
  g('verification-bounded', 3, 'Verification is not cheap enough to run unattended',
    'Independent execution needs a check that does not depend on a person reading the case.',
    [req('systems.verification', '>=', 4)]),
  g('observability-bounded', 3, 'Actions are not fully traceable',
    'You cannot review what a system did if it cannot say what it did.',
    [req('systems.observability', '>=', 4)]),

  /* --- consequence of being wrong -------------------------------- */
  g('reversibility-bounded', 3, 'Actions are hard to undo',
    'Reversibility is what makes an error a cost rather than an incident.',
    [req('risk.reversibility', '>=', 3)]),
  g('irreversible-consequential', 3, 'Irreversible actions carry serious consequence',
    'When a mistake is both expensive and permanent, a person approves before commit.',
    [req('risk.reversibility', '>=', 3)],
    (i) => i.risk.failureConsequence >= 4),
  g('consequence-severe', 3, 'Failure consequence is severe',
    'Severe outcomes require a named human in the path, whatever the measured error rate.',
    [req('risk.failureConsequence', '<=', 4)]),
  g('blast-systemic', 3, 'A single failure has systemic reach',
    'Automation multiplies throughput, including the throughput of mistakes.',
    [req('risk.blastRadius', '<=', 4)]),
  g('blast-unverified', 3, 'Wide blast radius without cheap verification',
    'A wide radius must be matched by a check that runs on every case.',
    [req('systems.verification', '>=', 4), req('systems.observability', '>=', 4)],
    (i) => i.risk.blastRadius >= 4),
  g('regulatory', 3, 'Regulated work requires an accountable human',
    'Some decisions require a named signatory by rule, regardless of system performance.',
    [req('risk.regulatorySensitivity', '<=', 3)]),
  g('permission-scope', 3, 'Privileged access without matching controls',
    'Broad credentials bound the blast radius, not the agent’s intent.',
    [req('systems.observability', '>=', 4), req('systems.verification', '>=', 4)],
    (i) => i.systems.permissionComplexity >= 4),

  /* --- exceptions and rules -------------------------------------- */
  g('exception-dominant', 2, 'Exceptions are the work',
    'When most cases fall off the normal path, the normal path is not the workflow.',
    [req('structure.exceptionRate', '<=', 4)]),
  g('exception-bounded', 3, 'Exceptions are too frequent for unattended running',
    'A high exception rate turns independent execution into a queue someone has to drain.',
    [req('structure.exceptionRate', '<=', 3)]),
  g('rules-under-consequence', 2, 'Unclear rules against serious consequence',
    'Specifying correct behaviour is a prerequisite for delegating consequential action.',
    [req('structure.ruleClarity', '>=', 3)],
    (i) => i.risk.failureConsequence >= 4),

  /* --- the human loop actually existing --------------------------- */
  g('escalation', 3, 'No reliable escalation path',
    'Every level above supervised assumes exceptions leave the system and reach a person.',
    [req('oversight.escalationAvailability', '>=', 3)]),
  g('feedback', 3, 'Outcomes are not observed',
    'Without an outcome signal, a claim to have earned more autonomy is unfalsifiable.',
    [req('oversight.feedbackAvailability', '>=', 3)]),

  /* --- the autonomous ceiling ------------------------------------- *
   * Level 5 requires every one of these. In practice it is reachable
   * only for work that is cheap to get wrong and trivial to undo.     */
  g('auto-verification', 4, 'Autonomy requires deterministic verification',
    'Minimal oversight is only defensible when correctness is checked automatically on every case.',
    [req('systems.verification', '>=', 5)]),
  g('auto-observability', 4, 'Autonomy requires complete traceability',
    'Aggregate monitoring replaces case review only when every case is reconstructable.',
    [req('systems.observability', '>=', 5)]),
  g('auto-reversibility', 4, 'Autonomy requires trivial reversal',
    'Without cheap reversal there is no safe way to discover a systematic error late.',
    [req('risk.reversibility', '>=', 5)]),
  g('auto-consequence', 4, 'Autonomy requires contained consequence',
    'Unsupervised operation is only appropriate where a wrong action is genuinely cheap.',
    [req('risk.failureConsequence', '<=', 3), req('risk.blastRadius', '<=', 3)]),
  g('auto-regulatory', 4, 'Autonomy requires an unregulated decision',
    'Policy and audit obligations imply a human in the record.',
    [req('risk.regulatorySensitivity', '<=', 1)]),
  g('auto-permission', 4, 'Autonomy requires narrow, scopeable permissions',
    'Unsupervised action must be bounded by what the credentials allow.',
    [req('systems.permissionComplexity', '<=', 2), req('risk.dataSensitivity', '<=', 2)]),
  g('auto-exceptions', 4, 'Autonomy requires a thin exception tail',
    'Unattended running assumes almost every case completes on the normal path.',
    [req('structure.exceptionRate', '<=', 2)]),
  g('auto-judgment', 4, 'Autonomy requires low judgment content',
    'Discretion that matters belongs to a person.',
    [req('structure.humanJudgment', '<=', 2)]),
  g('auto-platform', 4, 'Autonomy requires a complete tool surface',
    'Unsupervised work cannot route around a gap in access or tooling.',
    [req('systems.systemAccess', '>=', 5), req('systems.toolingReadiness', '>=', 5)]),
  g('auto-oversight', 4, 'Autonomy requires a staffed exception path',
    'Minimal synchronous oversight still assumes someone receives what the system rejects.',
    [req('oversight.escalationAvailability', '>=', 4), req('oversight.feedbackAvailability', '>=', 4)]),
]

export function requirementMet(input: AssessmentInput, r: Requirement): boolean {
  const v = readDimension(input, r.key)
  return r.op === '>=' ? v >= r.value : v <= r.value
}

export function gateActive(input: AssessmentInput, gate: Gate): boolean {
  if (gate.when && !gate.when(input)) return false
  return !gate.requirements.every((r) => requirementMet(input, r))
}

export function unmetRequirements(input: AssessmentInput, gate: Gate): Requirement[] {
  return gate.requirements.filter((r) => !requirementMet(input, r))
}

/* ------------------------------------------------------------------ *
 * Recommendation
 * ------------------------------------------------------------------ */

export type ZeroVariant = 'conventional' | 'human-led' | null

export interface AutonomyResult {
  level: AutonomyLevel
  meta: AutonomyLevelMeta
  /** Level 0 covers two different conclusions; these name the one that applies. */
  displayName: string
  displayShort: string
  /** Non-null when the ladder bottoms out for a specific reason. */
  zeroVariant: ZeroVariant
  /** Ceiling implied by readiness, before gates. */
  readinessCeiling: AutonomyLevel
  /** Highest rung the gates and readiness together permit. */
  ceiling: AutonomyLevel
  /** 0–1 readiness signal behind `readinessCeiling`. */
  readiness01: number
  /** Every gate currently active, ordered by cap ascending. */
  activeGates: Gate[]
  /** The active gates that actually set the recommendation. */
  bindingGates: Gate[]
  /** True when readiness, not a gate, is the binding constraint. */
  readinessBinds: boolean
}

const READINESS_THRESHOLDS: [number, AutonomyLevel][] = [
  [0.3, 1],
  [0.48, 2],
  [0.66, 3],
  [0.82, 4],
]

export function readinessCeilingFor(readiness01: number): AutonomyLevel {
  for (const [threshold, level] of READINESS_THRESHOLDS) {
    if (readiness01 < threshold) return level
  }
  return 5
}

/** Is this work deterministic enough that a language model adds nothing? */
export function isConventionalCandidate(input: AssessmentInput): boolean {
  const necessity = aiNecessity(
    input.structure.ruleClarity,
    input.structure.inputStructure,
    input.structure.contextBreadth,
  )
  return (
    necessity <= 0.12 &&
    input.structure.humanJudgment <= 2 &&
    input.structure.exceptionRate <= 2 &&
    input.structure.ruleClarity >= 4
  )
}

/** Is the honest recommendation to leave the work with people? */
export function isHumanLedCandidate(input: AssessmentInput): boolean {
  return (
    input.structure.humanJudgment >= 5 &&
    input.systems.verification <= 2 &&
    input.risk.failureConsequence >= 4
  )
}

export function computeAutonomy(input: AssessmentInput, fit: FitResult): AutonomyResult {
  const byId = Object.fromEntries(fit.components.map((c) => [c.id, c.ratio]))
  const readiness01 = clamp01(
    0.3 * (byId['technical'] ?? 0) +
      0.4 * (byId['controllability'] ?? 0) +
      0.3 * (byId['structure'] ?? 0),
  )
  const readinessCeiling = readinessCeilingFor(readiness01)

  const activeGates = GATES.filter((gate) => gateActive(input, gate)).toSorted((a, b) => a.cap - b.cap)
  const gateCap = activeGates.reduce<AutonomyLevel>((min, gate) => (gate.cap < min ? gate.cap : min), 5)

  let level: AutonomyLevel = Math.min(readinessCeiling, gateCap) as AutonomyLevel
  let zeroVariant: ZeroVariant = null

  if (isHumanLedCandidate(input)) {
    level = 0
    zeroVariant = 'human-led'
  } else if (isConventionalCandidate(input)) {
    level = 0
    zeroVariant = 'conventional'
  }

  const bindingGates = activeGates.filter((gate) => gate.cap === gateCap && gateCap <= readinessCeiling)

  const displayName =
    zeroVariant === 'human-led' ? 'Human-led'
    : zeroVariant === 'conventional' ? 'Conventional automation'
    : AUTONOMY_BY_LEVEL[level].name
  const displayShort =
    zeroVariant === 'human-led' ? 'Human-led'
    : zeroVariant === 'conventional' ? 'Conventional'
    : AUTONOMY_BY_LEVEL[level].short

  return {
    level,
    meta: AUTONOMY_BY_LEVEL[level],
    displayName,
    displayShort,
    zeroVariant,
    readinessCeiling,
    ceiling: Math.min(readinessCeiling, gateCap) as AutonomyLevel,
    readiness01,
    activeGates,
    bindingGates,
    readinessBinds: readinessCeiling < gateCap,
  }
}

/* ------------------------------------------------------------------ *
 * Path to a higher level
 * ------------------------------------------------------------------ */

export interface PathRequirement {
  key: DimensionKey
  label: string
  from: Score
  to: number
  op: '>=' | '<='
  /** Whether this is something to build, or something about the work. */
  nature: 'capability' | 'constraint'
}

export interface PathStep {
  gateId: string
  title: string
  detail: string
  requirements: PathRequirement[]
}

export interface AutonomyPath {
  target: AutonomyLevel | null
  targetMeta: AutonomyLevelMeta | null
  steps: PathStep[]
  /** True when readiness must also rise, not just gates clear. */
  readinessShortfall: boolean
  reachable: boolean
  /**
   * True when every remaining requirement is a constraint — the ceiling is a
   * property of the work, and no amount of building will move it.
   */
  structural: boolean
}

/**
 * What would have to change for the next rung. Derived by collecting every
 * active gate whose cap sits below the target and reporting its unmet
 * requirements — so the path is a consequence of the model, never a
 * hand-written list.
 */
export function pathToLevel(
  input: AssessmentInput,
  current: AutonomyResult,
  target?: AutonomyLevel,
): AutonomyPath {
  const goal = (target ?? (Math.min(5, Math.max(current.level, 0) + 1) as AutonomyLevel)) as AutonomyLevel
  if (goal > 5 || goal <= current.level) {
    return {
      target: null, targetMeta: null, steps: [],
      readinessShortfall: false, reachable: false, structural: false,
    }
  }

  // The same dimension can be named by several gates. Reporting it twice would
  // read as two pieces of work when it is one.
  const seen = new Set<DimensionKey>()
  const steps: PathStep[] = current.activeGates
    .filter((gate) => gate.cap < goal)
    .map((gate) => ({
      gateId: gate.id,
      title: gate.title,
      detail: gate.detail,
      requirements: unmetRequirements(input, gate)
        .filter((r) => {
          if (seen.has(r.key)) return false
          seen.add(r.key)
          return true
        })
        .map((r) => ({
          key: r.key,
          label: DIMENSION_BY_KEY[r.key].label,
          from: readDimension(input, r.key),
          to: r.value,
          op: r.op,
          nature: DIMENSION_BY_KEY[r.key].nature,
        })),
    }))
    .filter((s) => s.requirements.length > 0)

  const all = steps.flatMap((s) => s.requirements)

  return {
    target: goal,
    targetMeta: AUTONOMY_BY_LEVEL[goal],
    steps,
    readinessShortfall: current.readinessCeiling < goal,
    reachable: true,
    // Every remaining requirement is a property of the work. There is no path
    // here by investment, and calling the list a "path" would be a lie.
    structural: all.length > 0 && all.every((r) => r.nature === 'constraint'),
  }
}
