import type { Score } from '../domain/types'
import { PERIOD_PER_YEAR } from '../domain/types'
import type { WorkflowEconomics } from '../domain/types'

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

export const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n

/** 1..5 → 0..1. The canonical normalisation for every ordinal dimension. */
export const norm = (s: Score | number): number => clamp01((s - 1) / 4)

/** 1..5 → 1..0. Used wherever a high value is a liability. */
export const inv = (s: Score | number): number => clamp01((5 - s) / 4)

/**
 * Bounded logarithmic ramp. Returns 0 at or below `lo`, 1 at or above `hi`,
 * and interpolates on a log scale between them.
 *
 * Volume-like inputs span four orders of magnitude, so a linear scale would let
 * one extreme value dominate the model. A bounded log ramp keeps the difference
 * between 40 and 400 hours meaningful while ensuring 100,000 cases per week
 * cannot buy more than the 20 points the category is worth.
 */
export function logRamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value) || value <= lo) return 0
  if (value >= hi) return 1
  return clamp01((Math.log(value) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)))
}

export interface VolumeDerivation {
  casesPerWeek: number
  casesPerYear: number
  manualHoursPerWeek: number
  manualHoursPerYear: number
  /** Hands-on human hours consumed by one case. */
  hoursPerCase: number
}

export function deriveVolume(e: WorkflowEconomics): VolumeDerivation {
  const people = e.peopleInvolved ?? 1
  const perYear = PERIOD_PER_YEAR[e.period]
  const casesPerYear = Math.max(0, e.volume) * perYear
  const casesPerWeek = casesPerYear / 52
  const hoursPerCase = (Math.max(0, e.minutesPerCase) / 60) * people
  return {
    casesPerWeek,
    casesPerYear,
    hoursPerCase,
    manualHoursPerYear: casesPerYear * hoursPerCase,
    manualHoursPerWeek: casesPerWeek * hoursPerCase,
  }
}

/**
 * How much this workflow genuinely needs a language model, as opposed to a
 * script. Driven by unstructured input, unwritten rules, and breadth of context
 * that must be assembled rather than looked up.
 */
export function aiNecessity(ruleClarity: Score, inputStructure: Score, contextBreadth: Score): number {
  return clamp01(0.45 * inv(inputStructure) + 0.35 * inv(ruleClarity) + 0.2 * norm(contextBreadth))
}

/**
 * How well available system access covers the context the work demands.
 * Breadth is a demand, not a defect: it only costs points when access cannot
 * meet it.
 */
export function contextCoverage(systemAccess: Score, contextBreadth: Score): number {
  return clamp01(1 - Math.max(0, contextBreadth - systemAccess) / 4)
}
