import type { Assessment, AssessmentInput } from '../domain/types'
import { ALL_DIMENSION_KEYS } from '../domain/dimensions'

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface ConsistencyFlag {
  id: string
  message: string
}

export interface ConfidenceResult {
  level: ConfidenceLevel
  /** 0–1. Exposed so the methodology view can show the arithmetic. */
  score: number
  reviewedCount: number
  totalDimensions: number
  missingContext: string[]
  flags: ConsistencyFlag[]
}

/**
 * Pairs that are individually plausible but jointly unusual. Surfacing them is
 * more useful than silently averaging over them: they are usually a sign that
 * two dimensions were read differently from how they are defined.
 */
function consistencyFlags(input: AssessmentInput): ConsistencyFlag[] {
  const { economics: e, structure: s, systems: sys, risk: r, oversight: o } = input
  const flags: ConsistencyFlag[] = []

  if (sys.verification >= 4 && o.reviewCost >= 4) {
    flags.push({ id: 'verify-review', message: 'Verification is cheap but review is expensive. If a deterministic check exists, review should be cheaper than this.' })
  }
  if (sys.observability >= 4 && o.feedbackAvailability <= 2) {
    flags.push({ id: 'observe-feedback', message: 'Actions are traceable but outcomes are not observed. Traceability without an outcome signal usually means logging exists and nobody reads it.' })
  }
  if (s.ruleClarity >= 5 && s.humanJudgment >= 4) {
    flags.push({ id: 'rules-judgment', message: 'Rules are fully explicit yet expert judgment is central. One of these is probably overstated.' })
  }
  if (s.exceptionRate <= 1 && e.variability >= 4) {
    flags.push({ id: 'exception-variability', message: 'Cases vary substantially but exceptions are rare. Consider whether variation is being absorbed silently by people.' })
  }
  if (r.blastRadius >= 4 && r.failureConsequence <= 1) {
    flags.push({ id: 'blast-consequence', message: 'A failure reaches many parties but costs almost nothing. Worth re-reading both anchors.' })
  }
  if (sys.systemAccess >= 4 && sys.toolingReadiness <= 2) {
    flags.push({ id: 'access-tooling', message: 'Context is reachable but nothing is callable. Common and real — read access often long predates write interfaces.' })
  }
  if (r.reversibility >= 4 && r.failureConsequence >= 5) {
    flags.push({ id: 'reversible-severe', message: 'Actions are cheap to undo yet failure is severe. Usually means the severity is reputational or regulatory rather than transactional.' })
  }
  return flags
}

export function computeConfidence(assessment: Assessment): ConfidenceResult {
  const input = assessment.input
  const total = ALL_DIMENSION_KEYS.length
  const touched = new Set(assessment.touched)
  const reviewedCount = ALL_DIMENSION_KEYS.filter((k) => touched.has(k)).length

  const missingContext: string[] = []
  if (!input.definition.description.trim()) missingContext.push('No workflow description')
  if (input.economics.loadedHourlyCost === null) missingContext.push('No loaded hourly cost — capacity value not modelled')
  if (input.economics.peopleInvolved === null) missingContext.push('People per case not stated — assumed one')

  const flags = consistencyFlags(input)

  const reviewedRatio = reviewedCount / total
  const contextRatio = 1 - missingContext.length / 3
  const consistencyPenalty = Math.min(0.3, flags.length * 0.1)
  const score = Math.max(0, 0.65 * reviewedRatio + 0.35 * contextRatio - consistencyPenalty)

  const level: ConfidenceLevel = score >= 0.72 ? 'high' : score >= 0.42 ? 'medium' : 'low'

  return { level, score, reviewedCount, totalDimensions: total, missingContext, flags }
}

export const CONFIDENCE_MEANING: Record<ConfidenceLevel, string> = {
  low: 'Most dimensions are still at their preset values. Treat the output as a starting hypothesis.',
  medium: 'Enough of the assessment has been reviewed to be directionally useful.',
  high: 'The assessment has been reviewed dimension by dimension and reads consistently.',
}
