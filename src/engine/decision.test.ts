import { describe, expect, it } from 'vitest'
import type { Assessment, AssessmentInput, Decision } from '../domain/types'
import { EMPTY_DECISION } from '../domain/types'
import { archetypeInput, ARCHETYPES } from '../domain/archetypes'
import { assess } from './assess'
import { reviewDecision } from './decision'
import { MODEL_VERSION } from './version'
import { SCHEMA_VERSION } from '../persistence/migrate'

function record(input: AssessmentInput, decision: Partial<Decision> = {}): Assessment {
  return {
    id: 'x', schemaVersion: SCHEMA_VERSION, modelVersion: MODEL_VERSION, input,
    revisions: [], decision: { ...EMPTY_DECISION, ...decision }, notes: '', touched: [],
    riskEdits: {}, pilotEdits: {}, experimentEdits: {}, archived: false, example: false,
    createdAt: 0, updatedAt: 0,
  }
}

const review = (id: string, decision: Partial<Decision> = {}) => {
  const input = archetypeInput(id)
  return reviewDecision(record(input, decision), assess(input))
}

describe('decision record', () => {
  it('says plainly when nothing has been decided', () => {
    const r = review('payment-exception')
    expect(r.status).toBe('undecided')
    expect(r.divergence).toBe('none')
    expect(r.complete).toBe(false)
    expect(r.note).toMatch(/recommendation is not a decision/i)
  })

  it('falls back to the recommended level when no level was chosen', () => {
    const r = review('payment-exception', { status: 'proceeding' })
    expect(r.effectiveLevel).toBe(assess(archetypeInput('payment-exception')).autonomy.level)
    expect(r.divergence).toBe('none')
  })

  it('names every condition a more autonomous choice is made against', () => {
    // Payment exception is capped at supervised. Choosing bounded means
    // proceeding without the gates that cap below it.
    const recommended = assess(archetypeInput('payment-exception')).autonomy.level
    const r = review('payment-exception', { status: 'proceeding', chosenLevel: recommended + 1 })
    expect(r.divergence).toBe('above')
    expect(r.accepted.length).toBeGreaterThan(0)
    for (const c of r.accepted) expect(c.title.length).toBeGreaterThan(5)
    // At least one condition must carry the specifics.
    expect(r.accepted.some((c) => c.unmet.length > 0)).toBe(true)
    expect(r.note).toMatch(/accepted risk/i)
  })

  it('lists only gates that are genuinely unmet', () => {
    const input = archetypeInput('payment-exception')
    const recommended = assess(input).autonomy.level
    const r = reviewDecision(
      record(input, { status: 'proceeding', chosenLevel: recommended + 2 }),
      assess(input),
    )
    for (const c of r.accepted) {
      // Every listed requirement must actually fail against the current input.
      for (const u of c.unmet) {
        expect(u.op === '>=' ? u.from < u.to : u.from > u.to).toBe(true)
      }
    }
  })

  it('accepts a more conservative choice without objecting', () => {
    const recommended = assess(archetypeInput('support-triage')).autonomy.level
    const r = review('support-triage', { status: 'proceeding', chosenLevel: recommended - 1 })
    expect(r.divergence).toBe('below')
    expect(r.accepted).toEqual([])
    expect(r.divergenceKind).toBe('conservative')
    expect(r.note).toMatch(/nothing objects|ceiling, not a target/i)
  })

  it('treats deferral and decline as decisions in their own right', () => {
    for (const status of ['deferred', 'declined'] as const) {
      const r = review('compliance-review', { status })
      expect(r.status).toBe(status)
      expect(r.accepted).toEqual([])
      expect(r.headline.toLowerCase()).toContain(status === 'deferred' ? 'deferred' : 'declined')
    }
  })

  it('is incomplete until someone is accountable and the reasoning is written down', () => {
    expect(review('support-triage', { status: 'proceeding' }).missing).toEqual([
      'an accountable owner',
      'the reasoning',
    ])
    expect(
      review('support-triage', { status: 'proceeding', owner: 'A. Lead', rationale: 'Because.' })
        .complete,
    ).toBe(true)
  })

  it('produces a usable review for every archetype and status', () => {
    for (const a of ARCHETYPES) {
      for (const status of ['undecided', 'proceeding', 'deferred', 'declined'] as const) {
        const r = review(a.id, { status })
        expect(r.headline.length).toBeGreaterThan(5)
        expect(r.note.length).toBeGreaterThan(20)
        expect(r.effectiveLevel).toBeGreaterThanOrEqual(0)
        expect(r.effectiveLevel).toBeLessThanOrEqual(5)
      }
    }
  })

  it('never reports accepted conditions for a level the model already permits', () => {
    for (const a of ARCHETYPES) {
      const level = assess(archetypeInput(a.id)).autonomy.level
      const r = review(a.id, { status: 'proceeding', chosenLevel: level })
      expect(r.accepted).toEqual([])
    }
  })
})

describe('why a decision diverges, not just that it does', () => {
  it('does not claim the gates were exceeded when they were not', () => {
    // Reconciliation is level 0 because the work needs no model, yet its gates
    // permit bounded execution. Choosing bounded exceeds the recommendation
    // without exceeding anything the gates say.
    const r = review('reconciliation', { status: 'proceeding', chosenLevel: 4 })
    expect(r.divergence).toBe('above')
    expect(r.divergenceKind).toBe('unnecessary')
    expect(r.accepted).toEqual([])
    expect(r.note).not.toMatch(/higher autonomy level than the gates permit/i)
    expect(r.note).toMatch(/a model adds nothing|may not need/i)
  })

  it('names the gates when the gates really are the objection', () => {
    const recommended = assess(archetypeInput('payment-exception')).autonomy.level
    const r = review('payment-exception', { status: 'proceeding', chosenLevel: recommended + 1 })
    expect(r.divergenceKind).toBe('gated')
    expect(r.accepted.length).toBeGreaterThan(0)
    expect(r.note).toMatch(/unmet/i)
  })

  it('speaks to judgment when the work was meant to stay with people', () => {
    const r = review('compliance-review', { status: 'proceeding', chosenLevel: 3 })
    expect(r.divergenceKind).toBe('judgment')
    expect(r.note).toMatch(/no one can cheaply check|judgment is the deliverable/i)
  })

  it('uses the recommendation’s own name, not the ladder’s generic level-0 label', () => {
    const r = review('reconciliation', { status: 'proceeding', chosenLevel: 4 })
    expect(r.headline).toMatch(/conventional automation/i)
    expect(r.headline).not.toMatch(/conventional \/ human-led/i)
  })

  it('gives every divergence kind a note that fits it', () => {
    const kinds = new Set(
      ARCHETYPES.flatMap((a) =>
        [0, 1, 2, 3, 4, 5].map(
          (l) => review(a.id, { status: 'proceeding', chosenLevel: l }).divergenceKind,
        ),
      ),
    )
    expect(kinds.has('gated')).toBe(true)
    expect(kinds.has('unnecessary')).toBe(true)
    expect(kinds.has('judgment')).toBe(true)
    expect(kinds.has('conservative')).toBe(true)
    expect(kinds.has('none')).toBe(true)
  })
})

describe('accepted conditions do not repeat themselves', () => {
  it('names each unmet value once, however many gates rest on it', () => {
    for (const a of ARCHETYPES) {
      for (const level of [1, 2, 3, 4, 5]) {
        const r = review(a.id, { status: 'proceeding', chosenLevel: level })
        const seen = new Set<string>()
        for (const c of r.accepted) {
          for (const u of c.unmet) {
            const id = `${u.label}${u.op}${u.to}`
            expect(seen.has(id)).toBe(false)
            seen.add(id)
          }
        }
      }
    }
  })

  it('keeps a gate listed even once its requirement has been named elsewhere', () => {
    // Two gates rest on reversibility here; both are distinct reasons and both
    // stay on the record, but the value is only shown once.
    const r = review('payment-exception', { status: 'proceeding', chosenLevel: 4 })
    const titles = r.accepted.map((c) => c.title)
    expect(titles.length).toBeGreaterThan(1)
    expect(new Set(titles).size).toBe(titles.length)
  })
})
