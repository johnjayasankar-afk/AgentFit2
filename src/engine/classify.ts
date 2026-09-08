import type { FitResult } from './fit'
import type { AutonomyResult } from './autonomy'
import type { ReadinessResult } from './readiness'
import type { InvestmentEstimate } from './investment'

export type PortfolioClass =
  | 'build-now'
  | 'de-risk-first'
  | 'assist-only'
  | 'automate-conventionally'
  | 'low-priority'

export interface PortfolioClassMeta {
  id: PortfolioClass
  label: string
  meaning: string
}

export const PORTFOLIO_CLASSES: Record<PortfolioClass, PortfolioClassMeta> = {
  'build-now': {
    id: 'build-now',
    label: 'Build now',
    meaning: 'Economics justify the work and the controls to run it safely already exist.',
  },
  'de-risk-first': {
    id: 'de-risk-first',
    label: 'De-risk first',
    meaning:
      'The value is real but something has to change first — a missing prerequisite, or a return too slow to justify this scope.',
  },
  'assist-only': {
    id: 'assist-only',
    label: 'Assist, don’t agentify',
    meaning: 'AI is useful here, but independent action is not appropriate at any near-term horizon.',
  },
  'automate-conventionally': {
    id: 'automate-conventionally',
    label: 'Automate conventionally',
    meaning: 'Specified enough that ordinary software is cheaper to build, run, and certify.',
  },
  'low-priority': {
    id: 'low-priority',
    label: 'Low priority',
    meaning: 'The effort is not repaid by the capacity returned. Fund something with a faster return first.',
  },
}

/**
 * A planning recommendation for sequencing work across a portfolio — not an
 * objective ranking. It reads the fit components, the autonomy ceiling and the
 * readiness state together, because each of the five outcomes is caused by a
 * different one of them.
 */
/**
 * The bar for "build now". Set above a middling assessment on purpose: a
 * workflow scoring in the fifties has enough unresolved weakness that funding
 * the weakness is the better first move, even when nothing is outright blocked.
 */
export const BUILD_NOW_FIT = 62

export function classify(
  fit: FitResult,
  autonomy: AutonomyResult,
  readiness: ReadinessResult,
  investment: InvestmentEstimate,
): PortfolioClassMeta {
  const economic = fit.components.find((c) => c.id === 'economic')?.ratio ?? 0

  if (autonomy.zeroVariant === 'conventional') return PORTFOLIO_CLASSES['automate-conventionally']
  if (economic < 0.28) return PORTFOLIO_CLASSES['low-priority']
  if (autonomy.zeroVariant === 'human-led') return PORTFOLIO_CLASSES['assist-only']

  const readyEnough = readiness.level === 'pilot' || readiness.level === 'production-candidate'
  // "Build now" has to clear a return bar as well as a readiness bar. A build
  // that repays in three years is a real option, but it is not the one to start
  // on Monday — and saying so is the whole point of pricing the work.
  const worthBuilding = investment.verdict !== 'unfavourable'
  const returnsSoonEnough =
    investment.verdict === 'strong' ||
    investment.verdict === 'plausible' ||
    investment.verdict === 'no-build'

  // Where the environment is ready and the return still is not there, the
  // problem is priority rather than readiness — sending it to "de-risk first"
  // would point a team at groundwork that would not change the answer.
  if (!worthBuilding && readyEnough && autonomy.level >= 1) {
    return PORTFOLIO_CLASSES['low-priority']
  }

  if (autonomy.level <= 2) {
    // Distinguish "held down by risk" from "held down by missing groundwork".
    const heldByRisk = autonomy.bindingGates.some((g) =>
      ['judgment-irreducible', 'judgment-expert', 'regulatory', 'consequence-severe'].includes(g.id),
    )
    if (heldByRisk) return PORTFOLIO_CLASSES['assist-only']
    return readyEnough && returnsSoonEnough && fit.score >= BUILD_NOW_FIT
      ? PORTFOLIO_CLASSES['build-now']
      : PORTFOLIO_CLASSES['de-risk-first']
  }

  if (fit.score >= BUILD_NOW_FIT && readyEnough && returnsSoonEnough) {
    return PORTFOLIO_CLASSES['build-now']
  }
  return PORTFOLIO_CLASSES['de-risk-first']
}
