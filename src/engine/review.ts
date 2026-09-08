import type { DimensionKey } from '../domain/types'
import { DIMENSION_BY_KEY } from '../domain/dimensions'
import type { AssessmentResult } from './assess'
import { ECONOMICS_KEYS, type Grounding, type LoadBearingValue } from './grounding'

/**
 * The guided pass.
 *
 * Eight cycles of work went into what AgentFit says. Almost none went into the
 * part a user actually has to do: answer twenty questions honestly. The product
 * already knows which of them this particular recommendation rests on — that is
 * what grounding is — and until now its whole answer was to scroll the relevant
 * slider into view. That is a bookmark, not help.
 *
 * A review takes those values one at a time, shows the five published anchors
 * as a choice rather than a slider position, and — this is the point — says
 * what the answer did to the recommendation *after* it is given.
 *
 * The ordering of that last part is a deliberate stance. Showing the
 * consequence of each option *before* choosing would turn an honest
 * self-assessment into a menu of outcomes, and this instrument exists to
 * resist exactly that. Showing it afterwards preserves the self-report and
 * still teaches where the model is sensitive. Someone who genuinely wants to
 * explore "what if verification were better" has the Scenario Lab, which is
 * labelled as hypothetical for the same reason.
 */

export type ReviewKind = 'dimension' | 'economics'

export interface ReviewStep {
  key: string
  kind: ReviewKind
  label: string
  /** Why this assessment depends on it, in the grounding engine's words. */
  reason: string
}

/**
 * The values to walk, in the order grounding ranks them: what could flip the
 * answer first, then what sets the ceiling, then what merely feeds it.
 *
 * Computed once when a review starts and then followed to the end. Answering
 * one value genuinely changes which others are load-bearing, but re-sorting a
 * queue underneath someone mid-pass is disorienting and makes progress
 * meaningless. The change is surfaced at the end instead, where it reads as
 * something learned rather than as the ground moving.
 */
export function buildReviewQueue(grounding: Grounding): ReviewStep[] {
  return grounding.nextToReview.map(toStep)
}

/** Every load-bearing value, reviewed or not — for a deliberate second pass. */
export function fullReviewQueue(grounding: Grounding): ReviewStep[] {
  return [...grounding.loadBearing]
    .toSorted((a, b) => a.priority - b.priority)
    .map(toStep)
}

function toStep(v: LoadBearingValue): ReviewStep {
  const economics = v.key === ECONOMICS_KEYS.volume || v.key === ECONOMICS_KEYS.minutesPerCase
  return {
    key: v.key,
    kind: economics ? 'economics' : 'dimension',
    label: v.label,
    reason: v.reason,
  }
}

/** True when a key names one of the twenty published 1–5 dimensions. */
export function isDimensionKey(key: string): key is DimensionKey {
  return key in DIMENSION_BY_KEY
}

/* ------------------------------------------------------------------ *
 * What an answer did
 * ------------------------------------------------------------------ */

/**
 * Ranked by what a reader would care about most. A recommendation that moved
 * outranks a readiness state that moved, which outranks a score that shifted a
 * point or two — and "nothing moved" is a real result worth stating rather
 * than a blank.
 */
export type OutcomeWeight = 'recommendation' | 'readiness' | 'score' | 'none'

export interface ReviewOutcome {
  weight: OutcomeWeight
  /** One sentence, in the product's voice. */
  note: string
  fitBefore: number
  fitAfter: number
  autonomyBefore: string
  autonomyAfter: string
}

/** Lowercase a title unless it opens with something that must stay capitalised. */
function lower(title: string | undefined): string {
  if (!title) return ''
  return /^[A-Z][a-z]/.test(title) ? title[0]!.toLowerCase() + title.slice(1) : title
}

export function reviewOutcome(
  before: AssessmentResult,
  after: AssessmentResult,
): ReviewOutcome {
  const autonomyBefore = before.autonomy.displayName
  const autonomyAfter = after.autonomy.displayName
  const fitBefore = before.fit.score
  const fitAfter = after.fit.score

  const base = { fitBefore, fitAfter, autonomyBefore, autonomyAfter }

  if (autonomyBefore !== autonomyAfter) {
    const direction = after.autonomy.level > before.autonomy.level ? 'up to' : 'down to'
    // Gate titles are a mix of sentences and noun phrases, so they are carried
    // as a labelled fragment rather than folded into one — "access is
    // incomplete is what caps it" is not a sentence anyone wrote on purpose.
    const cause = after.autonomy.readinessBinds
      ? 'readiness, not a gate'
      : lower(after.autonomy.bindingGates[0]?.title)
    return {
      ...base,
      weight: 'recommendation',
      note: `That moved the recommendation ${direction} ${autonomyAfter.toLowerCase()}.${
        cause ? ` Binding constraint: ${cause}.` : ''
      }`,
    }
  }

  if (before.readiness.meta.label !== after.readiness.meta.label) {
    return {
      ...base,
      weight: 'readiness',
      note: `The recommendation held at ${autonomyAfter.toLowerCase()}, but readiness moved from ${before.readiness.meta.label.toLowerCase()} to ${after.readiness.meta.label.toLowerCase()}.`,
    }
  }

  if (fitBefore !== fitAfter) {
    const delta = fitAfter - fitBefore
    return {
      ...base,
      weight: 'score',
      note: `Fit ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} to ${fitAfter}. The recommendation is still ${autonomyAfter.toLowerCase()}.`,
    }
  }

  return {
    ...base,
    weight: 'none',
    note: `No movement — the recommendation is ${autonomyAfter.toLowerCase()} either way. Confirming it still matters: it is now on the record rather than assumed.`,
  }
}

/* ------------------------------------------------------------------ *
 * What the whole pass did
 * ------------------------------------------------------------------ */

export interface ReviewSummary {
  reviewed: number
  /** Load-bearing values that were not load-bearing when the pass started. */
  newlyLoadBearing: ReviewStep[]
  fitBefore: number
  fitAfter: number
  autonomyBefore: string
  autonomyAfter: string
  moved: boolean
  headline: string
  detail: string
}

export function summariseReview(
  reviewed: readonly string[],
  before: AssessmentResult,
  after: AssessmentResult,
  groundingAfter: Grounding,
): ReviewSummary {
  // Anything still unconfirmed after the pass became load-bearing *because* of
  // it — the queue was everything unconfirmed when the pass began.
  const newlyLoadBearing = groundingAfter.nextToReview
    .filter((v) => !reviewed.includes(v.key))
    .map(toStep)

  const moved = before.autonomy.displayName !== after.autonomy.displayName
  const n = reviewed.length

  const headline = moved
    ? `${after.autonomy.displayName}, after ${n} ${n === 1 ? 'answer' : 'answers'}`
    : n === 0
      ? 'Nothing left to confirm'
      : `${after.autonomy.displayName}, confirmed`

  const detail = moved
    ? `The recommendation moved from ${before.autonomy.displayName.toLowerCase()} once real values replaced the preset. Fit ${before.fit.score} → ${after.fit.score}.`
    : n === 0
      ? 'Every value this recommendation rests on has already been reviewed.'
      : `The preset was already pointing at the right answer; your values confirmed it rather than changing it. Fit ${before.fit.score} → ${after.fit.score}.`

  return {
    reviewed: n,
    newlyLoadBearing,
    fitBefore: before.fit.score,
    fitAfter: after.fit.score,
    autonomyBefore: before.autonomy.displayName,
    autonomyAfter: after.autonomy.displayName,
    moved,
    headline,
    detail,
  }
}
