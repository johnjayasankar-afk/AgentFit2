import type { AssessmentInput } from '../domain/types'
import { aiNecessity, clamp01, contextCoverage, deriveVolume, inv, logRamp, norm } from './normalize'

export type FitComponentId =
  | 'economic'
  | 'structure'
  | 'technical'
  | 'controllability'
  | 'riskSuitability'
  | 'judgment'

export interface FitComponent {
  id: FitComponentId
  label: string
  /** Points earned, rounded for display but exact in `ratio`. */
  earned: number
  max: number
  /** 0–1 before weighting. */
  ratio: number
  /** One line explaining what moved this component. */
  driver: string
}

export interface FitResult {
  /** 0–100, deterministic. */
  score: number
  components: FitComponent[]
  /** Intermediate values other engines reuse. */
  detail: {
    economicUtility: number
    repetitionUtility: number
    manualHoursPerYear: number
    manualHoursPerWeek: number
    casesPerYear: number
    casesPerWeek: number
    aiNecessity: number
    contextCoverage: number
  }
}

export const FIT_WEIGHTS: Record<FitComponentId, number> = {
  economic: 20,
  structure: 15,
  technical: 20,
  controllability: 20,
  riskSuitability: 15,
  judgment: 10,
}

/**
 * Inverted-U over human judgment.
 *
 * Mechanical work (1) scores below the peak because it rarely needs a model at
 * all. Structured professional judgment (2–3) is the sweet spot: enough
 * ambiguity to justify a model, enough structure to constrain it. Where expert
 * judgment is the deliverable (5), automating around it removes the value.
 */
const JUDGMENT_CURVE: Record<number, number> = { 1: 0.75, 2: 1.0, 3: 0.85, 4: 0.45, 5: 0.12 }

/**
 * Work that needs no language model should not score as a strong *agent*
 * candidate, however attractive its economics. Below the floor the component is
 * halved; the pattern engine then recommends deterministic automation.
 */
function necessityMultiplier(necessity: number): number {
  const FLOOR = 0.12
  const FULL = 0.3
  if (necessity <= FLOOR) return 0.5
  if (necessity >= FULL) return 1
  return 0.5 + (0.5 * (necessity - FLOOR)) / (FULL - FLOOR)
}

/** Annual manual hours that map to zero and full economic utility. */
export const ECONOMIC_HOURS_RANGE = [40, 6000] as const
/** Annual case counts that map to zero and full repetition utility. */
export const ECONOMIC_CASES_RANGE = [40, 20000] as const

export function computeFit(input: AssessmentInput): FitResult {
  const { economics: e, structure: s, systems: sys, risk: r, oversight: o } = input
  const vol = deriveVolume(e)

  /* --- 01 Economic opportunity ---------------------------------- */
  const hoursUtility = logRamp(vol.manualHoursPerYear, ECONOMIC_HOURS_RANGE[0], ECONOMIC_HOURS_RANGE[1])
  const repetitionUtility = logRamp(vol.casesPerYear, ECONOMIC_CASES_RANGE[0], ECONOMIC_CASES_RANGE[1])
  const economic = clamp01((0.65 * hoursUtility + 0.35 * repetitionUtility) * (1 - 0.1 * norm(e.variability)))

  /* --- 02 Workflow structure ------------------------------------ */
  const structure = clamp01(
    0.34 * norm(s.ruleClarity) +
      0.28 * norm(s.inputStructure) +
      0.28 * inv(s.exceptionRate) +
      0.1 * inv(e.variability),
  )

  /* --- 03 Technical readiness ----------------------------------- */
  const coverage = contextCoverage(sys.systemAccess, s.contextBreadth)
  const technical = clamp01(
    0.3 * norm(sys.systemAccess) +
      0.25 * norm(sys.toolingReadiness) +
      0.2 * norm(sys.observability) +
      0.25 * coverage,
  )

  /* --- 04 Controllability --------------------------------------- */
  const controlBase =
    0.3 * norm(r.reversibility) +
    0.3 * norm(sys.verification) +
    0.2 * norm(o.feedbackAvailability) +
    0.2 * norm(o.escalationAvailability)
  const controllability = clamp01(controlBase * (1 - 0.15 * norm(o.reviewCost)))

  /* --- 05 Risk suitability -------------------------------------- */
  const riskSuitability = clamp01(
    0.35 * inv(r.failureConsequence) +
      0.25 * inv(r.blastRadius) +
      0.2 * inv(r.regulatorySensitivity) +
      0.1 * inv(sys.permissionComplexity) +
      0.1 * inv(r.dataSensitivity),
  )

  /* --- 06 Judgment suitability ---------------------------------- */
  const necessity = aiNecessity(s.ruleClarity, s.inputStructure, s.contextBreadth)
  const judgment = clamp01((JUDGMENT_CURVE[s.humanJudgment] ?? 0.5) * necessityMultiplier(necessity))

  const ratios: Record<FitComponentId, number> = {
    economic,
    structure,
    technical,
    controllability,
    riskSuitability,
    judgment,
  }

  const drivers: Record<FitComponentId, string> = {
    economic: economicDriver(vol.manualHoursPerYear, vol.casesPerYear),
    structure: pick(structure, 'Rules and inputs are hard to specify', 'Partly specifiable, exceptions cost coverage', 'Describable and repeatable'),
    technical: pick(technical, 'Context and actions are not reachable in software', 'Access exists but is incomplete', 'Context and actions are reachable'),
    controllability: pick(controllability, 'Errors are hard to catch or undo', 'Partial ability to catch and undo errors', 'Errors are catchable and reversible'),
    riskSuitability: pick(riskSuitability, 'A mistake is expensive and travels far', 'Moderate exposure on failure', 'A mistake is cheap and contained'),
    judgment: judgmentDriver(s.humanJudgment, necessity),
  }

  const components: FitComponent[] = (Object.keys(FIT_WEIGHTS) as FitComponentId[]).map((id) => ({
    id,
    label: FIT_COMPONENT_LABEL[id],
    max: FIT_WEIGHTS[id],
    ratio: ratios[id],
    earned: ratios[id] * FIT_WEIGHTS[id],
    driver: drivers[id],
  }))

  const score = Math.round(components.reduce((sum, c) => sum + c.earned, 0))

  return {
    score,
    components,
    detail: {
      economicUtility: economic,
      repetitionUtility,
      manualHoursPerYear: vol.manualHoursPerYear,
      manualHoursPerWeek: vol.manualHoursPerWeek,
      casesPerYear: vol.casesPerYear,
      casesPerWeek: vol.casesPerWeek,
      aiNecessity: necessity,
      contextCoverage: coverage,
    },
  }
}

export const FIT_COMPONENT_LABEL: Record<FitComponentId, string> = {
  economic: 'Economic opportunity',
  structure: 'Workflow structure',
  technical: 'Technical readiness',
  controllability: 'Controllability',
  riskSuitability: 'Risk suitability',
  judgment: 'Judgment suitability',
}

function pick(ratio: number, low: string, mid: string, high: string): string {
  return ratio < 0.4 ? low : ratio < 0.7 ? mid : high
}

function economicDriver(hoursPerYear: number, casesPerYear: number): string {
  if (hoursPerYear < 120) return 'Too little time at stake to justify a build'
  if (hoursPerYear < 600) return 'Modest but real time at stake'
  const fte = hoursPerYear / 1800
  return `About ${fte < 1 ? fte.toFixed(1) : Math.round(fte)} FTE of effort across ${formatCount(casesPerYear)} cases a year`
}

function judgmentDriver(humanJudgment: number, necessity: number): string {
  if (necessity <= 0.12) return 'Deterministic enough that a model may be unnecessary'
  if (humanJudgment >= 5) return 'Expert judgment is the deliverable, not the overhead'
  if (humanJudgment === 4) return 'Substantial expertise remains irreducible'
  if (humanJudgment <= 1) return 'Mechanical work — check whether plain code is cheaper'
  return 'Structured judgment — constrained enough to specify'
}

function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
