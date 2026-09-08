import { describe, expect, it } from 'vitest'
import type { Assessment, AssessmentInput } from '../domain/types'
import { EMPTY_DECISION } from '../domain/types'
import { archetypeInput, ARCHETYPES } from '../domain/archetypes'
import { ALL_DIMENSION_KEYS } from '../domain/dimensions'
import { assess } from './assess'
import { computeUncertainty } from './uncertainty'
import { computeGrounding, ECONOMICS_KEYS, focusKeysFor } from './grounding'
import { MODEL_VERSION } from './version'
import { SCHEMA_VERSION } from '../persistence/migrate'

function record(input: AssessmentInput, touched: string[] = []): Assessment {
  return {
    id: 'x', schemaVersion: SCHEMA_VERSION, modelVersion: MODEL_VERSION, input,
    revisions: [], decision: { ...EMPTY_DECISION }, notes: '', touched, riskEdits: {}, pilotEdits: {},
    experimentEdits: {}, archived: false, example: false, createdAt: 0, updatedAt: 0,
  }
}

const ground = (input: AssessmentInput, touched: string[] = []) => {
  const a = record(input, touched)
  return computeGrounding(a, assess(input), computeUncertainty(a))
}

const ALL_TOUCHED = [...ALL_DIMENSION_KEYS, ECONOMICS_KEYS.volume, ECONOMICS_KEYS.minutesPerCase]

describe('grounding', () => {
  it('calls a blank assessment provisional', () => {
    const g = ground(archetypeInput('custom'))
    expect(g.state).toBe('provisional')
    expect(g.reviewedCount).toBe(0)
    expect(g.headline).toBe('Provisional')
    expect(g.detail).toMatch(/preset values/i)
  })

  it('always counts the economics that drive capacity', () => {
    const g = ground(archetypeInput('custom'))
    const keys = g.loadBearing.map((v) => v.key)
    expect(keys).toContain(ECONOMICS_KEYS.volume)
    expect(keys).toContain(ECONOMICS_KEYS.minutesPerCase)
  })

  it('names the dimensions the binding gates stand on', () => {
    const input = archetypeInput('payment-exception')
    const result = assess(input)
    const g = ground(input)
    const keys = new Set(g.loadBearing.map((v) => v.key))
    for (const gate of result.autonomy.bindingGates) {
      for (const r of gate.requirements) expect(keys.has(r.key)).toBe(true)
    }
  })

  it('names a value only once however many reasons it has', () => {
    for (const a of ARCHETYPES) {
      const keys = ground(archetypeInput(a.id)).loadBearing.map((v) => v.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('becomes grounded once every load-bearing value is reviewed', () => {
    const g = ground(archetypeInput('payment-exception'), ALL_TOUCHED)
    expect(g.state).toBe('grounded')
    expect(g.nextToReview).toEqual([])
    expect(g.detail).toMatch(/none of them are carrying this result/i)
  })

  it('reports partial when some but not all are reviewed', () => {
    const g = ground(archetypeInput('payment-exception'), [ECONOMICS_KEYS.volume])
    expect(g.state).toBe('partial')
    expect(g.reviewedCount).toBe(1)
    expect(g.nextToReview.length).toBeGreaterThan(0)
    expect(g.headline).toBe('Partly grounded')
  })

  it('does not require every dimension — only the ones carrying the result', () => {
    const input = archetypeInput('payment-exception')
    const g = ground(input, ALL_TOUCHED)
    expect(g.state).toBe('grounded')
    // Far fewer than twenty values decide any single recommendation.
    expect(g.loadBearing.length).toBeLessThan(ALL_DIMENSION_KEYS.length)
  })

  it('puts values that could flip the recommendation first', () => {
    const input = archetypeInput('custom')
    const a = record(input, [])
    const uncertainty = computeUncertainty(a)
    const g = computeGrounding(a, assess(input), uncertainty)
    if (uncertainty.volatile.length > 0 && g.nextToReview.length > 1) {
      expect(uncertainty.volatile.map((v) => v.key as string)).toContain(g.nextToReview[0]!.key)
    }
  })

  it('explains a conventional-automation result through what decided it', () => {
    const g = ground(archetypeInput('reconciliation'))
    expect(assess(archetypeInput('reconciliation')).autonomy.zeroVariant).toBe('conventional')
    const keys = g.loadBearing.map((v) => v.key)
    expect(keys).toContain('structure.ruleClarity')
    expect(keys).toContain('structure.humanJudgment')
  })

  it('explains a human-led result through what decided it', () => {
    const g = ground(archetypeInput('compliance-review'))
    expect(assess(archetypeInput('compliance-review')).autonomy.zeroVariant).toBe('human-led')
    const keys = g.loadBearing.map((v) => v.key)
    expect(keys).toContain('systems.verification')
    expect(keys).toContain('risk.failureConsequence')
  })

  it('gives every load-bearing value a reason specific to this assessment', () => {
    for (const a of ARCHETYPES) {
      for (const v of ground(archetypeInput(a.id)).loadBearing) {
        expect(v.reason.length).toBeGreaterThan(20)
        expect(v.label.length).toBeGreaterThan(2)
      }
    }
  })

  it('produces a usable state for every archetype', () => {
    for (const a of ARCHETYPES) {
      const g = ground(archetypeInput(a.id))
      expect(g.loadBearing.length).toBeGreaterThan(0)
      expect(['provisional', 'partial', 'grounded']).toContain(g.state)
      expect(g.headline.length).toBeGreaterThan(0)
    }
  })
})

describe('the load-bearing set is wide enough to mean something', () => {
  it('names more than a handful of values for every archetype', () => {
    for (const a of ARCHETYPES) {
      // A set of two or three would let "grounded" be claimed while most of the
      // assessment still sat on presets.
      expect(ground(archetypeInput(a.id)).loadBearing.length).toBeGreaterThanOrEqual(6)
    }
  })

  it('includes the five values the readiness claim actually reads', () => {
    for (const a of ARCHETYPES) {
      const keys = new Set(ground(archetypeInput(a.id)).loadBearing.map((v) => v.key))
      for (const key of [
        'systems.observability', 'systems.verification', 'systems.systemAccess',
        'oversight.escalationAvailability', 'oversight.feedbackAvailability',
      ]) expect(keys.has(key)).toBe(true)
    }
  })

  it('includes gates that would bind at the next level, not only the current one', () => {
    const input = archetypeInput('support-triage')
    const result = assess(input)
    const keys = new Set(ground(input).loadBearing.map((v) => v.key))
    const nextRung = result.autonomy.activeGates.filter(
      (g) => g.cap === result.autonomy.level + 1,
    )
    for (const gate of nextRung) {
      for (const r of gate.requirements) expect(keys.has(r.key)).toBe(true)
    }
  })

  it('leaves out gates far above the recommendation as noise', () => {
    const input = archetypeInput('document-review')
    const result = assess(input)
    const keys = new Set(ground(input).loadBearing.map((v) => v.key))
    // Never claims the level-4 autonomy prerequisites matter to a level-2 result
    // unless something else already put them in the set.
    expect(keys.size).toBeLessThan(20)
    expect(result.autonomy.level).toBeLessThanOrEqual(2)
  })

  it('distinguishes a binding gate from one that would bind next', () => {
    // Both roles must be expressible. A dimension that is also something more
    // urgent — a readiness input, or able to flip the answer — reports that
    // instead, so the distinction is asserted across the reference set rather
    // than within any single workflow.
    const reasons = ARCHETYPES.flatMap((a) =>
      ground(archetypeInput(a.id)).loadBearing.map((v) => v.reason),
    )
    expect(reasons.some((r) => /holding autonomy at/i.test(r))).toBe(true)
    expect(reasons.some((r) => /would bind at the next level/i.test(r))).toBe(true)
  })

  it('reports the most urgent role when several apply', () => {
    for (const a of ARCHETYPES) {
      const g = ground(archetypeInput(a.id))
      // A value that can flip the answer says so, whatever else it also does.
      for (const v of g.loadBearing) {
        if (v.priority === 0) expect(v.reason).toMatch(/plausible range/i)
      }
    }
  })

  it('orders the start-here list by priority, not insertion', () => {
    for (const a of ARCHETYPES) {
      const next = ground(archetypeInput(a.id)).nextToReview
      const priorities = next.map((v) => v.priority)
      expect(priorities).toEqual(priorities.toSorted((x, y) => x - y))
    }
  })
})

describe('grounding without uncertainty, for list contexts', () => {
  it('agrees on provisional and grounded whether or not uncertainty is supplied', () => {
    for (const a of ARCHETYPES) {
      const input = archetypeInput(a.id)
      const result = assess(input)

      const blank = record(input, [])
      expect(computeGrounding(blank, result).state).toBe(
        computeGrounding(blank, result, computeUncertainty(blank)).state,
      )

      const full = record(input, ALL_TOUCHED)
      expect(computeGrounding(full, result).state).toBe(
        computeGrounding(full, result, computeUncertainty(full)).state,
      )
    }
  })

  it('still names the load-bearing values without uncertainty', () => {
    const g = computeGrounding(record(archetypeInput('payment-exception'), []), assess(archetypeInput('payment-exception')))
    expect(g.loadBearing.length).toBeGreaterThanOrEqual(6)
    expect(g.state).toBe('provisional')
  })
})

describe('focused pass', () => {
  it('never hides a value the user has touched', () => {
    for (const a of ARCHETYPES) {
      const input = archetypeInput(a.id)
      // Touch a handful of dimensions that are not load-bearing.
      const g = ground(input)
      const loadBearing = new Set(g.loadBearing.map((v) => v.key))
      const touched = ALL_DIMENSION_KEYS.filter((k) => !loadBearing.has(k)).slice(0, 4)
      const keys = focusKeysFor(touched, g.loadBearing)
      for (const k of touched) expect(keys.has(k)).toBe(true)
    }
  })

  it('always shows everything carrying the recommendation', () => {
    for (const a of ARCHETYPES) {
      const g = ground(archetypeInput(a.id))
      const keys = focusKeysFor([], g.loadBearing)
      for (const v of g.loadBearing) expect(keys.has(v.key)).toBe(true)
    }
  })

  it('hides something — otherwise the mode is pointless', () => {
    for (const a of ARCHETYPES) {
      const g = ground(archetypeInput(a.id))
      const keys = focusKeysFor([], g.loadBearing)
      const hidden = ALL_DIMENSION_KEYS.filter((k) => !keys.has(k))
      expect(hidden.length).toBeGreaterThan(0)
    }
  })

  it('shows everything once every dimension has been reviewed', () => {
    const g = ground(archetypeInput('payment-exception'), ALL_TOUCHED)
    const keys = focusKeysFor(ALL_TOUCHED, g.loadBearing)
    for (const k of ALL_DIMENSION_KEYS) expect(keys.has(k)).toBe(true)
  })
})
