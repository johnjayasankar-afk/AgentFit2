import { describe, expect, it } from 'vitest'
import { assess } from './assess'
import { computeGrounding } from './grounding'
import {
  buildReviewQueue,
  fullReviewQueue,
  isDimensionKey,
  reviewOutcome,
  summariseReview,
} from './review'
import { archetypeInput } from '../domain/archetypes'
import { writeDimension } from '../domain/dimensions'
import { deriveVolume } from './normalize'
import { createAssessment } from '../persistence/db'
import type { Assessment, AssessmentInput, DimensionKey, Score } from '../domain/types'

function withTouched(a: Assessment, keys: string[]): Assessment {
  return { ...a, touched: keys }
}

function groundingFor(a: Assessment) {
  return computeGrounding(a, assess(a.input))
}

function set(input: AssessmentInput, key: DimensionKey, value: Score): AssessmentInput {
  return writeDimension(input, key, value)
}

describe('the review queue', () => {
  it('is exactly what the recommendation still rests on, unconfirmed', () => {
    const a = createAssessment('support-triage')
    const g = groundingFor(a)
    const queue = buildReviewQueue(g)

    expect(queue.length).toBe(g.nextToReview.length)
    expect(queue.length).toBeGreaterThan(0)
    expect(queue.map((s) => s.key)).toEqual(g.nextToReview.map((v) => v.key))
  })

  it('follows grounding’s ordering — what could flip the answer comes first', () => {
    const g = groundingFor(createAssessment('payment-exception'))
    const priorities = g.nextToReview.map((v) => v.priority)
    expect(priorities).toEqual([...priorities].toSorted((x, y) => x - y))
  })

  it('shrinks as values are confirmed, and empties when they all are', () => {
    const a = createAssessment('support-triage')
    const all = groundingFor(a).loadBearing.map((v) => v.key)

    expect(buildReviewQueue(groundingFor(a)).length).toBe(all.length)
    expect(buildReviewQueue(groundingFor(withTouched(a, all.slice(0, 2)))).length).toBe(
      all.length - 2,
    )
    expect(buildReviewQueue(groundingFor(withTouched(a, all))).length).toBe(0)
  })

  it('still offers a full pass once nothing is outstanding', () => {
    const a = createAssessment('support-triage')
    const g = groundingFor(withTouched(a, groundingFor(a).loadBearing.map((v) => v.key)))

    expect(buildReviewQueue(g)).toEqual([])
    expect(fullReviewQueue(g).length).toBe(g.loadBearing.length)
  })

  it('marks the two economics figures as numbers, not ordinals', () => {
    const queue = fullReviewQueue(groundingFor(createAssessment('support-triage')))
    const economics = queue.filter((s) => s.kind === 'economics')

    expect(economics.map((s) => s.key).toSorted()).toEqual([
      'economics.minutesPerCase',
      'economics.volume',
    ])
    // Everything else must resolve against the published dimension registry, or
    // the panel would have no anchors to show.
    for (const step of queue.filter((s) => s.kind === 'dimension')) {
      expect(isDimensionKey(step.key)).toBe(true)
    }
  })

  it('carries a reason for every step — a question with no "why" is a form field', () => {
    for (const step of fullReviewQueue(groundingFor(createAssessment('research')))) {
      expect(step.reason.length).toBeGreaterThan(10)
      expect(step.label.length).toBeGreaterThan(0)
    }
  })
})

describe('what an answer did', () => {
  const base = archetypeInput('support-triage')

  it('reports a moved recommendation above everything else', () => {
    const before = assess(base)
    // Incomplete system access caps what the agent may do on its own.
    const after = assess(set(base, 'systems.systemAccess', 2))
    const outcome = reviewOutcome(before, after)

    expect(before.autonomy.displayName).not.toBe(after.autonomy.displayName)
    expect(outcome.weight).toBe('recommendation')
    expect(outcome.note).toContain(after.autonomy.displayName.toLowerCase())
    expect(outcome.autonomyBefore).toBe(before.autonomy.displayName)
    expect(outcome.autonomyAfter).toBe(after.autonomy.displayName)
  })

  it('names what is holding the new ceiling, so the move is explicable', () => {
    const outcome = reviewOutcome(assess(base), assess(set(base, 'systems.systemAccess', 2)))
    expect(outcome.note).toMatch(/Binding constraint: .+\./)
  })

  it('says so plainly when nothing moved', () => {
    const before = assess(base)
    const outcome = reviewOutcome(before, before)

    expect(outcome.weight).toBe('none')
    expect(outcome.note).toContain('No movement')
    // The value of confirming an unchanged value is stated rather than implied.
    expect(outcome.note).toContain('on the record')
  })

  it('falls back to the score when the recommendation holds', () => {
    const before = assess(base)
    let after = before
    // Walk a dimension that feeds the score without touching a gate.
    for (const v of [1, 2, 4, 5] as Score[]) {
      const candidate = assess(set(base, 'economics.variability', v))
      if (
        candidate.autonomy.displayName === before.autonomy.displayName &&
        candidate.readiness.meta.label === before.readiness.meta.label &&
        candidate.fit.score !== before.fit.score
      ) {
        after = candidate
        break
      }
    }

    const outcome = reviewOutcome(before, after)
    expect(outcome.weight).toBe('score')
    expect(outcome.note).toContain(String(after.fit.score))
    expect(outcome.fitBefore).toBe(before.fit.score)
  })

  it('never claims a movement that did not happen', () => {
    // Across every dimension and every value, a "recommendation" verdict must
    // correspond to an actual change of recommendation.
    const keys: DimensionKey[] = [
      'systems.verification',
      'systems.systemAccess',
      'risk.reversibility',
      'structure.humanJudgment',
      'oversight.reviewCost',
    ]
    const before = assess(base)
    for (const key of keys) {
      for (const v of [1, 2, 3, 4, 5] as Score[]) {
        const after = assess(set(base, key, v))
        const outcome = reviewOutcome(before, after)
        const moved = before.autonomy.displayName !== after.autonomy.displayName
        expect(outcome.weight === 'recommendation').toBe(moved)
        if (outcome.weight === 'none') {
          expect(after.fit.score).toBe(before.fit.score)
          expect(after.readiness.meta.label).toBe(before.readiness.meta.label)
        }
      }
    }
  })
})

describe('the figures a review shows', () => {
  /**
   * Regression. The review card first recomputed annual hours inline and left
   * `peopleInvolved` out, so a workflow touched by three people reported a
   * third of the hours the assessment sheet printed from the same inputs. Two
   * surfaces disagreeing about one number is worse than either being wrong.
   */
  it('counts every person who touches a case', () => {
    const one = deriveVolume({ ...archetypeInput('custom').economics, volume: 200, minutesPerCase: 30, peopleInvolved: 1 })
    const three = deriveVolume({ ...archetypeInput('custom').economics, volume: 200, minutesPerCase: 30, peopleInvolved: 3 })

    expect(one.manualHoursPerYear).toBeCloseTo(200 * 52 * 0.5, 5)
    expect(three.manualHoursPerYear).toBeCloseTo(one.manualHoursPerYear * 3, 5)
  })

  it('treats a missing head count as one person, not as zero', () => {
    const e = { ...archetypeInput('custom').economics, volume: 100, minutesPerCase: 60 }
    expect(deriveVolume({ ...e, peopleInvolved: null }).manualHoursPerYear).toBe(
      deriveVolume({ ...e, peopleInvolved: 1 }).manualHoursPerYear,
    )
  })
})

describe('what the pass did', () => {
  it('reports values that only became load-bearing because of the answers', () => {
    const a = createAssessment('support-triage')
    const before = assess(a.input)

    // Confirm the original queue, then let the model re-derive what matters.
    const originalQueue = buildReviewQueue(groundingFor(a)).map((s) => s.key)
    const answered = withTouched(a, originalQueue)
    const after = assess(answered.input)
    const summary = summariseReview(originalQueue, before, after, groundingFor(answered))

    expect(summary.reviewed).toBe(originalQueue.length)
    // Whatever it reports as newly load-bearing must genuinely be unconfirmed
    // and outside the queue the user actually walked.
    for (const v of summary.newlyLoadBearing) {
      expect(originalQueue).not.toContain(v.key)
      expect(answered.touched).not.toContain(v.key)
    }
  })

  it('distinguishes a preset that was confirmed from one that was corrected', () => {
    const a = createAssessment('support-triage')
    const before = assess(a.input)

    const held = summariseReview(['systems.systemAccess'], before, before, groundingFor(a))
    expect(held.moved).toBe(false)
    expect(held.headline).toContain(before.autonomy.displayName)
    expect(held.detail).toContain('confirmed it rather than changing it')

    const correctedInput = set(a.input, 'systems.systemAccess', 2)
    const changed = summariseReview(
      ['systems.systemAccess'],
      before,
      assess(correctedInput),
      groundingFor({ ...a, input: correctedInput }),
    )
    expect(changed.moved).toBe(true)
    expect(changed.headline).toContain(assess(correctedInput).autonomy.displayName)
    expect(changed.detail).toContain(before.autonomy.displayName.toLowerCase())
  })

  it('handles a pass with nothing left to do', () => {
    const a = createAssessment('support-triage')
    const all = groundingFor(a).loadBearing.map((v) => v.key)
    const result = assess(a.input)
    const summary = summariseReview([], result, result, groundingFor(withTouched(a, all)))

    expect(summary.reviewed).toBe(0)
    expect(summary.newlyLoadBearing).toEqual([])
    expect(summary.headline).toBe('Nothing left to confirm')
  })
})
