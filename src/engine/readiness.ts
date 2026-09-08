import type { AssessmentInput } from '../domain/types'
import type { AutonomyResult } from './autonomy'

export type ReadinessLevel = 'not-ready' | 'discovery' | 'pilot' | 'production-candidate'

export interface ReadinessMeta {
  id: ReadinessLevel
  label: string
  index: string
  meaning: string
}

export const READINESS_LEVELS: Record<ReadinessLevel, ReadinessMeta> = {
  'not-ready': {
    id: 'not-ready',
    label: 'Not ready',
    index: '00',
    meaning: 'A prerequisite is missing that no amount of prompt or model work will substitute for.',
  },
  discovery: {
    id: 'discovery',
    label: 'Discovery ready',
    index: '01',
    meaning: 'Enough exists to prototype and learn. Not enough exists to run against real cases.',
  },
  pilot: {
    id: 'pilot',
    label: 'Pilot ready',
    index: '02',
    meaning: 'Instrumentation and an exception path exist. A limited pilot on real cases is defensible.',
  },
  'production-candidate': {
    id: 'production-candidate',
    label: 'Production candidate',
    index: '03',
    meaning: 'Prerequisites appear sufficient for controlled production evaluation. This is not an authorisation.',
  },
}

export interface ReadinessBlocker {
  label: string
  detail: string
}

export interface ReadinessResult {
  level: ReadinessLevel
  meta: ReadinessMeta
  /** What holds readiness at its current level. */
  blockers: ReadinessBlocker[]
  /** What the next readiness level would require. */
  nextRequirements: ReadinessBlocker[]
}

const b = (label: string, detail: string): ReadinessBlocker => ({ label, detail })

/**
 * Readiness answers a different question from autonomy: not "how independently
 * should this act" but "is the environment prepared to build and run it at
 * all". A workflow can be perfectly suited to a supervised agent and still be
 * Not Ready because nothing is instrumented.
 */
export function computeReadiness(input: AssessmentInput, autonomy: AutonomyResult): ReadinessResult {
  const { systems: sys, oversight: o, risk: r } = input

  const criticalBlockers: ReadinessBlocker[] = []
  if (sys.systemAccess <= 2) {
    criticalBlockers.push(b('No programmatic access', 'Context cannot be retrieved by software. This is an integration project before it is an AI project.'))
  }
  if (sys.toolingReadiness <= 1 && autonomy.level >= 2) {
    criticalBlockers.push(b('No usable interfaces', 'There is nothing stable for an agent to call.'))
  }
  if (sys.observability <= 1) {
    criticalBlockers.push(b('Outcomes are invisible', 'Nothing can be evaluated, because nothing can be reconstructed.'))
  }
  if (autonomy.zeroVariant === 'human-led') {
    criticalBlockers.push(b('Judgment is the deliverable', 'The recommendation is to keep the work with people, so implementation readiness is not the operative question.'))
  }

  const pilotRequirements: ReadinessBlocker[] = []
  if (sys.observability < 3) pilotRequirements.push(b('Observability ≥ 3', 'A pilot you cannot reconstruct produces anecdotes, not evidence.'))
  if (sys.verification < 3) pilotRequirements.push(b('Verification ≥ 3', 'Someone has to be able to say whether a pilot case was handled correctly.'))
  if (o.escalationAvailability < 3) pilotRequirements.push(b('Escalation ≥ 3', 'Pilot cases will fail; a named owner has to receive them.'))
  if (o.feedbackAvailability < 3) pilotRequirements.push(b('Feedback ≥ 3', 'Without captured outcomes the pilot cannot answer the question it exists to answer.'))
  if (sys.systemAccess < 3) pilotRequirements.push(b('System access ≥ 3', 'A pilot on real cases needs real context.'))

  const productionRequirements: ReadinessBlocker[] = []
  if (sys.verification < 4) productionRequirements.push(b('Verification ≥ 4', 'Controlled production evaluation needs checks that do not depend on a reviewer reading each case.'))
  if (sys.observability < 4) productionRequirements.push(b('Observability ≥ 4', 'Per-case traceability is the precondition for an incident review.'))
  if (o.feedbackAvailability < 4) productionRequirements.push(b('Feedback ≥ 4', 'Outcome capture has to be close to complete before rates mean anything.'))
  if (r.reversibility < 3 && autonomy.level >= 4) {
    productionRequirements.push(b('Reversibility ≥ 3', 'Independent execution without a reversal path is not a candidate for production evaluation.'))
  }
  if (autonomy.level < 1) {
    productionRequirements.push(b('An agent pattern', 'The recommendation is not to build an agent, so there is nothing to evaluate in production.'))
  }

  let level: ReadinessLevel
  if (criticalBlockers.length > 0) level = 'not-ready'
  else if (pilotRequirements.length > 0) level = 'discovery'
  else if (productionRequirements.length > 0) level = 'pilot'
  else level = 'production-candidate'

  const blockers =
    level === 'not-ready' ? criticalBlockers
    : level === 'discovery' ? pilotRequirements
    : level === 'pilot' ? productionRequirements
    : []

  const nextRequirements =
    level === 'not-ready' ? pilotRequirements
    : level === 'discovery' ? productionRequirements
    : []

  return { level, meta: READINESS_LEVELS[level], blockers, nextRequirements }
}

export const READINESS_DISCLAIMER =
  'AgentFit supports workflow discovery and architecture decisions. It does not authorise production deployment.'
