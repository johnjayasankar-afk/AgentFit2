import type { Assessment, AssessmentInput } from '../domain/types'
import { MODEL_VERSION } from './version'
import { computeFit, type FitResult } from './fit'
import { computeAutonomy, pathToLevel, type AutonomyPath, type AutonomyResult } from './autonomy'
import { computePattern, type PatternResult } from './pattern'
import { computeControls, type ControlPosture } from './controls'
import { computeReadiness, type ReadinessResult } from './readiness'
import { computeCapacity, type CapacityEstimate } from './economics'
import { computeExplanation, type Explanation } from './explanation'
import { computeRisks, type RiskEntry } from './risks'
import { computeEvaluation, computeExperiment, computePilot, type EvaluationMetric, type NextExperiment, type PilotPlan } from './plan'
import { computeArchitecture, type ArchNode } from './architecture'
import { classify, type PortfolioClassMeta } from './classify'
import { computeConfidence, type ConfidenceResult } from './confidence'
import { computeInvestment, type InvestmentEstimate } from './investment'

export interface AssessmentResult {
  modelVersion: string
  fit: FitResult
  autonomy: AutonomyResult
  pattern: PatternResult
  controls: ControlPosture
  readiness: ReadinessResult
  capacity: CapacityEstimate
  investment: InvestmentEstimate
  explanation: Explanation
  risks: RiskEntry[]
  experiment: NextExperiment
  pilot: PilotPlan
  evaluation: EvaluationMetric[]
  architecture: ArchNode[]
  path: AutonomyPath
  classification: PortfolioClassMeta
}

/**
 * The single entry point to the decision model.
 *
 * Order matters and encodes the product's argument: fit is computed from the
 * workflow alone; autonomy is computed separately and can be — and often is —
 * far below what the fit score alone would suggest; everything downstream
 * (pattern, controls, capacity, pilot) follows from the autonomy level rather
 * than from the score.
 */
export function assess(input: AssessmentInput): AssessmentResult {
  const fit = computeFit(input)
  const autonomy = computeAutonomy(input, fit)
  const pattern = computePattern(input, autonomy)
  const controls = computeControls(input, autonomy)
  const readiness = computeReadiness(input, autonomy)
  const capacity = computeCapacity(input, autonomy.level, autonomy.zeroVariant)
  const investment = computeInvestment(input, autonomy, pattern, controls, capacity)
  const explanation = computeExplanation(input, fit, autonomy, capacity, pattern)
  const risks = computeRisks(input, autonomy)
  const experiment = computeExperiment(input, autonomy, readiness, capacity)
  const pilot = computePilot(input, autonomy, pattern, capacity)
  const evaluation = computeEvaluation(input, autonomy)
  const architecture = computeArchitecture(pattern.pattern.id)
  const path = pathToLevel(input, autonomy)
  const classification = classify(fit, autonomy, readiness, investment)

  return {
    modelVersion: MODEL_VERSION,
    fit,
    autonomy,
    pattern,
    controls,
    readiness,
    capacity,
    investment,
    explanation,
    risks,
    experiment,
    pilot,
    evaluation,
    architecture,
    path,
    classification,
  }
}

/** Convenience for callers holding a stored assessment record. */
export function assessRecord(record: Assessment): AssessmentResult & { confidence: ConfidenceResult } {
  return { ...assess(record.input), confidence: computeConfidence(record) }
}
