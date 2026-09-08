import type { AssessmentInput, CapacityAssumptions, Score } from '../domain/types'
import { PERIOD_PER_YEAR } from '../domain/types'
import { clamp, clamp01, contextCoverage, deriveVolume, inv, norm } from './normalize'
import type { AutonomyLevel, ZeroVariant } from './autonomy'

export interface ResolvedAssumptions {
  coveragePct: number
  timeReductionPct: number
  reviewRatePct: number
  reviewMinutes: number
  exceptionMinutes: number
  /** Which values the user has overridden. */
  overridden: Record<keyof CapacityAssumptions, boolean>
}

export interface CalcStep {
  label: string
  expression: string
  value: string
}

export interface CapacityEstimate {
  /** Per week, unless stated. */
  manualHours: number
  coveredCases: number
  casesPerWeek: number
  automatedHours: number
  reviewHours: number
  exceptionHours: number
  netCapacityHours: number
  /** Same figures annualised. */
  annual: {
    manualHours: number
    netCapacityHours: number
    /** Null unless a loaded hourly cost was supplied. */
    capacityValue: number | null
  }
  assumptions: ResolvedAssumptions
  steps: CalcStep[]
}

/**
 * Default time reduction by autonomy level. These are starting assumptions, not
 * measurements — the product exposes them as editable precisely because the
 * honest answer is that a team must measure their own.
 */
export const DEFAULT_TIME_REDUCTION: Record<AutonomyLevel, number> = {
  0: 80,
  1: 28,
  2: 50,
  3: 75,
  4: 85,
  5: 92,
}

/** Share of covered cases carrying an explicit human oversight touch. */
export const DEFAULT_REVIEW_RATE: Record<AutonomyLevel, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 100,
  4: 15,
  5: 5,
}

/** Minutes of oversight per reviewed case, by how hard the work is to check. */
const REVIEW_MINUTES_BY_COST: Record<Score, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 15 }

/**
 * Coverage — the share of cases the system completes without handing back.
 * Driven by how specifiable the work is and how often it leaves the normal
 * path, then capped by how much of the required context is actually reachable.
 */
export function derivedCoverage(input: AssessmentInput): number {
  const { structure: s, economics: e, systems: sys } = input
  const base =
    0.35 +
    0.3 * norm(s.ruleClarity) +
    0.2 * norm(s.inputStructure) -
    0.35 * norm(s.exceptionRate) -
    0.1 * norm(e.variability)
  const reach = 0.6 + 0.4 * contextCoverage(sys.systemAccess, s.contextBreadth)
  return Math.round(clamp(clamp01(base) * reach, 0.02, 0.95) * 100)
}

export function derivedExceptionMinutes(input: AssessmentInput): number {
  return Math.round(clamp(input.economics.minutesPerCase * 0.15, 1, 20))
}

export function resolveAssumptions(
  input: AssessmentInput,
  level: AutonomyLevel,
  zeroVariant: ZeroVariant = null,
): ResolvedAssumptions {
  const a = input.assumptions
  // Keeping the work with people returns no capacity — that is the recommendation.
  const defaultReduction = zeroVariant === 'human-led' ? 0 : DEFAULT_TIME_REDUCTION[level]
  return {
    coveragePct: a.coveragePct ?? (zeroVariant === 'human-led' ? 0 : derivedCoverage(input)),
    timeReductionPct: a.timeReductionPct ?? defaultReduction,
    reviewRatePct: a.reviewRatePct ?? DEFAULT_REVIEW_RATE[level],
    reviewMinutes: a.reviewMinutes ?? REVIEW_MINUTES_BY_COST[input.oversight.reviewCost],
    exceptionMinutes: a.exceptionMinutes ?? derivedExceptionMinutes(input),
    overridden: {
      coveragePct: a.coveragePct !== null,
      timeReductionPct: a.timeReductionPct !== null,
      reviewRatePct: a.reviewRatePct !== null,
      reviewMinutes: a.reviewMinutes !== null,
      exceptionMinutes: a.exceptionMinutes !== null,
    },
  }
}

const h = (n: number): string => `${n.toFixed(n < 10 ? 1 : 0)} h`

/**
 * Capacity model. Four lines of arithmetic, all of them shown.
 *
 *   automated  = covered cases × hours per case × time reduction
 *   review     = covered cases × review rate × review minutes
 *   exceptions = handed-back cases × exception minutes
 *   net        = automated − review − exceptions
 *
 * The result is potential capacity returned. It is not a cost saving: freed
 * hours become savings only if the organisation actually removes the cost, and
 * that is a decision this tool does not model.
 */
export function computeCapacity(
  input: AssessmentInput,
  level: AutonomyLevel,
  zeroVariant: ZeroVariant = null,
): CapacityEstimate {
  const vol = deriveVolume(input.economics)
  const assumptions = resolveAssumptions(input, level, zeroVariant)

  const coverage = assumptions.coveragePct / 100
  const reduction = assumptions.timeReductionPct / 100
  const reviewRate = assumptions.reviewRatePct / 100

  const casesPerWeek = vol.casesPerWeek
  const coveredCases = casesPerWeek * coverage
  const handedBack = casesPerWeek - coveredCases

  const manualHours = vol.manualHoursPerWeek
  const automatedHours = coveredCases * vol.hoursPerCase * reduction
  const reviewHours = (coveredCases * reviewRate * assumptions.reviewMinutes) / 60
  // Hand-back triage is a cost of the system attempting the case. With no
  // coverage there is no system, so there is no triage overhead to charge.
  const exceptionHours = coverage > 0 ? (handedBack * assumptions.exceptionMinutes) / 60 : 0
  const netCapacityHours = automatedHours - reviewHours - exceptionHours

  const annualNet = netCapacityHours * 52
  const cost = input.economics.loadedHourlyCost

  const steps: CalcStep[] = [
    {
      label: 'Manual effort',
      expression: `${fmt(casesPerWeek)} cases/wk × ${fmt(vol.hoursPerCase * 60)} min`,
      value: h(manualHours),
    },
    {
      label: 'Covered by the system',
      expression: `${fmt(casesPerWeek)} × ${assumptions.coveragePct}% coverage`,
      value: `${fmt(coveredCases)} cases`,
    },
    {
      label: 'Execution time removed',
      expression: `${fmt(coveredCases)} cases × ${fmt(vol.hoursPerCase * 60)} min × ${assumptions.timeReductionPct}%`,
      value: h(automatedHours),
    },
    {
      label: 'Human oversight added',
      expression: reviewRate === 0
        ? 'no separate oversight step at this level'
        : `${fmt(coveredCases)} × ${assumptions.reviewRatePct}% × ${assumptions.reviewMinutes} min`,
      value: `− ${h(reviewHours)}`,
    },
    {
      label: 'Handed-back cases',
      expression: `${fmt(handedBack)} cases × ${assumptions.exceptionMinutes} min triage`,
      value: `− ${h(exceptionHours)}`,
    },
    {
      label: 'Net capacity returned',
      expression: 'per week, under the assumptions above',
      value: h(netCapacityHours),
    },
  ]

  return {
    manualHours,
    coveredCases,
    casesPerWeek,
    automatedHours,
    reviewHours,
    exceptionHours,
    netCapacityHours,
    annual: {
      manualHours: vol.manualHoursPerYear,
      netCapacityHours: annualNet,
      capacityValue: cost !== null && cost > 0 ? annualNet * cost : null,
    },
    assumptions,
    steps,
  }
}

function fmt(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString('en-US')
  if (n >= 10) return n.toFixed(0)
  return n.toFixed(1)
}

/** Manual hours per the workflow's own stated period, for display. */
export function manualHoursPerPeriod(input: AssessmentInput): number {
  const vol = deriveVolume(input.economics)
  return (vol.manualHoursPerYear / PERIOD_PER_YEAR[input.economics.period])
}

/** Rough drag on realisable coverage from case-to-case variability. */
export function variabilityDrag(input: AssessmentInput): number {
  return 1 - 0.1 * inv(input.economics.variability)
}
