import type { Assessment, DimensionKey } from '../domain/types'
import { DIMENSION_BY_KEY } from '../domain/dimensions'
import type { AssessmentResult } from './assess'
import type { Uncertainty } from './uncertainty'

/**
 * What the recommendation actually rests on, and whether any of it has been
 * confirmed by a person.
 *
 * A blank assessment still produces a complete result, because every dimension
 * has a defensible preset. That is useful — the instrument should respond from
 * the first moment — but presenting it in the same voice as a reviewed
 * assessment would be a claim the product cannot support. "Pilot ready:
 * instrumentation and an exception path exist" is a statement about someone's
 * organisation, and at zero reviewed dimensions it is a statement about
 * nothing.
 *
 * Rather than gate on an arbitrary count, this identifies the values the
 * current recommendation genuinely depends on — the economics that drive
 * capacity, the dimensions named by the gates that set the ceiling, and the
 * ones whose plausible range could flip it — and reports how many of those the
 * user has actually looked at. It is a provenance measure, not a confidence
 * one: a preset can be right and still be unconfirmed.
 */

export type GroundingState = 'provisional' | 'partial' | 'grounded'

/**
 * Lower sorts first. A list headed "start here" has to be genuinely ordered:
 * something that could flip the answer outranks something that sets the
 * ceiling, which outranks a gate that would only matter one rung up.
 */
export const PRIORITY = {
  volatile: 0,
  binding: 1,
  economics: 2,
  readiness: 3,
  nextRung: 4,
  decisive: 1,
} as const

export interface LoadBearingValue {
  /** A dimension key, or one of the economics field keys below. */
  key: string
  label: string
  reviewed: boolean
  /** Why this particular assessment depends on it. */
  reason: string
  /** Ordering weight; see `PRIORITY`. */
  priority: number
}

export interface Grounding {
  state: GroundingState
  /** Everything the current recommendation depends on. */
  loadBearing: LoadBearingValue[]
  reviewedCount: number
  /** Unreviewed load-bearing values, most consequential first. */
  nextToReview: LoadBearingValue[]
  headline: string
  detail: string
}

/** Economics inputs are tracked in `touched` under these keys. */
export const ECONOMICS_KEYS = {
  volume: 'economics.volume',
  minutesPerCase: 'economics.minutesPerCase',
} as const

const ECONOMICS_LABEL: Record<string, string> = {
  [ECONOMICS_KEYS.volume]: 'Workflow volume',
  [ECONOMICS_KEYS.minutesPerCase]: 'Time per case',
}

/**
 * `uncertainty` is optional so lists can compute grounding cheaply. Omitting it
 * drops only the volatile dimensions from the set — which are almost always
 * already named by a gate — and never changes whether an assessment reads as
 * provisional or grounded, only the exact denominator in the partial case.
 */
export function computeGrounding(
  assessment: Assessment,
  result: AssessmentResult,
  uncertainty?: Uncertainty,
): Grounding {
  const touched = new Set(assessment.touched)
  const seen = new Set<string>()
  const loadBearing: LoadBearingValue[] = []

  const add = (key: string, label: string, reason: string, priority: number) => {
    const existing = loadBearing.find((v) => v.key === key)
    if (existing) {
      // Keep the most urgent reason when several apply.
      if (priority < existing.priority) {
        existing.priority = priority
        existing.reason = reason
      }
      return
    }
    seen.add(key)
    loadBearing.push({ key, label, reviewed: touched.has(key), reason, priority })
  }

  // Volume and duration set the capacity estimate and most of the economic
  // component. Nothing else in the model moves those numbers.
  add(ECONOMICS_KEYS.volume, ECONOMICS_LABEL[ECONOMICS_KEYS.volume]!, 'Sets the capacity estimate and most of the economic score.', PRIORITY.economics)
  add(ECONOMICS_KEYS.minutesPerCase, ECONOMICS_LABEL[ECONOMICS_KEYS.minutesPerCase]!, 'Sets the capacity estimate and most of the economic score.', PRIORITY.economics)

  // The dimensions the gates are standing on — both the ones binding now and
  // the ones that would bind at the next rung. A set built only from the
  // current binding gate would be tiny, and confirming three values would then
  // claim the whole result was grounded while most of it still sat on presets.
  for (const gate of result.autonomy.activeGates) {
    if (gate.cap > result.autonomy.level + 1) continue
    const binding = result.autonomy.bindingGates.some((b) => b.id === gate.id)
    for (const r of gate.requirements) {
      const meta = DIMENSION_BY_KEY[r.key]
      add(
        r.key,
        meta.label,
        binding
          ? `Named by the gate holding autonomy at ${result.autonomy.displayShort.toLowerCase()}.`
          : 'Named by a gate that would bind at the next level.',
        binding ? PRIORITY.binding : PRIORITY.nextRung,
      )
    }
  }

  // Readiness is the most assertive thing the panel says — "instrumentation and
  // an exception path exist" is a claim about someone's organisation. These are
  // the five values it reads.
  for (const key of [
    'systems.observability',
    'systems.verification',
    'systems.systemAccess',
    'oversight.escalationAvailability',
    'oversight.feedbackAvailability',
  ] as DimensionKey[]) {
    add(key, DIMENSION_BY_KEY[key].label, `Decides the readiness state, currently ${result.readiness.meta.label.toLowerCase()}.`, PRIORITY.readiness)
  }

  // Dimensions whose plausible range would change the recommendation outright.
  for (const v of uncertainty?.volatile ?? []) {
    add(v.key, v.label, 'Its plausible range spans more than one recommendation.', PRIORITY.volatile)
  }

  // For a level-0 recommendation the gates are not what decided it, so name
  // what did instead.
  if (result.autonomy.zeroVariant === 'conventional') {
    for (const key of ['structure.ruleClarity', 'structure.inputStructure', 'structure.humanJudgment'] as DimensionKey[]) {
      add(key, DIMENSION_BY_KEY[key].label, 'Decides whether a model is needed here at all.', PRIORITY.decisive)
    }
  } else if (result.autonomy.zeroVariant === 'human-led') {
    for (const key of ['structure.humanJudgment', 'systems.verification', 'risk.failureConsequence'] as DimensionKey[]) {
      add(key, DIMENSION_BY_KEY[key].label, 'Decides whether the work should stay with people.', PRIORITY.decisive)
    }
  }

  const reviewedCount = loadBearing.filter((v) => v.reviewed).length
  const state: GroundingState =
    reviewedCount === 0 ? 'provisional' : reviewedCount === loadBearing.length ? 'grounded' : 'partial'

  const nextToReview = loadBearing
    .filter((v) => !v.reviewed)
    .toSorted((a, b) => a.priority - b.priority)

  return {
    state,
    loadBearing,
    reviewedCount,
    nextToReview,
    ...describe(state, loadBearing.length, nextToReview.length),
  }
}

function describe(
  state: GroundingState,
  total: number,
  remaining: number,
): { headline: string; detail: string } {
  switch (state) {
    case 'provisional':
      return {
        headline: 'Provisional',
        detail: `Every figure below comes from preset values. This recommendation rests on ${total} of them and none have been confirmed, so treat it as a starting position rather than an answer.`,
      }
    case 'partial':
      return {
        headline: 'Partly grounded',
        detail: `${remaining} of the values this recommendation depends on ${remaining === 1 ? 'is' : 'are'} still at ${remaining === 1 ? 'its' : 'their'} preset. Reviewing ${remaining === 1 ? 'it' : 'them'} is what turns this from a starting position into an assessment.`,
      }
    case 'grounded':
      return {
        headline: 'Grounded',
        detail: `Every value this recommendation depends on has been reviewed. Other dimensions may still be at their presets, but none of them are carrying this result.`,
      }
  }
}

/**
 * Which values a focused pass shows.
 *
 * The union of what is carrying the recommendation and what the user has
 * already engaged with. The second half is the safety property: a slider must
 * never disappear because reviewing it changed which values are load-bearing.
 */
export function focusKeysFor(
  touched: readonly string[],
  loadBearing: readonly LoadBearingValue[],
): Set<string> {
  const keys = new Set<string>(touched)
  for (const v of loadBearing) keys.add(v.key)
  return keys
}
