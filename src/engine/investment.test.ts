import { describe, expect, it } from 'vitest'
import type { Assessment, AssessmentInput, DimensionKey, Score } from '../domain/types'
import { EMPTY_DECISION } from '../domain/types'
import { archetypeInput, ARCHETYPES } from '../domain/archetypes'
import { writeDimension } from '../domain/dimensions'
import { assess } from './assess'
import { computeSensitivity } from './sensitivity'
import { computeUncertainty } from './uncertainty'
import { MODEL_VERSION } from './version'
import { SCHEMA_VERSION } from '../persistence/migrate'
import { ALL_DIMENSION_KEYS, DIMENSION_BY_KEY, DIMENSIONS } from '../domain/dimensions'

function record(input: AssessmentInput, touched: string[] = []): Assessment {
  return {
    id: 'x',
    schemaVersion: SCHEMA_VERSION,
    modelVersion: MODEL_VERSION,
    input,
    revisions: [],
    decision: { ...EMPTY_DECISION },
    notes: '',
    touched,
    riskEdits: {},
    pilotEdits: {},
    experimentEdits: {},
    archived: false,
    example: false,
    createdAt: 0,
    updatedAt: 0,
  }
}

const withCost = (id: string, weekly: number | null = 4000): AssessmentInput => {
  const base = archetypeInput(id)
  return { ...base, economics: { ...base.economics, engineeringWeeklyCost: weekly } }
}

/* ------------------------------------------------------------------ *
 * Investment
 * ------------------------------------------------------------------ */

describe('investment estimate', () => {
  it('costs nothing when the recommendation is to keep the work human', () => {
    const r = assess(archetypeInput('compliance-review'))
    expect(r.autonomy.zeroVariant).toBe('human-led')
    expect(r.investment.effortWeeks.mid).toBe(0)
    expect(r.investment.verdict).toBe('no-build')
    expect(r.investment.drivers).toHaveLength(0)
  })

  it('always returns a range, never a point estimate', () => {
    const r = assess(archetypeInput('payment-exception'))
    expect(r.investment.effortWeeks.low).toBeLessThan(r.investment.effortWeeks.mid)
    expect(r.investment.effortWeeks.high).toBeGreaterThan(r.investment.effortWeeks.mid)
  })

  it('skews the range right, because effort estimates do', () => {
    const { effortWeeks: e } = assess(archetypeInput('payment-exception')).investment
    expect(e.high - e.mid).toBeGreaterThan(e.mid - e.low)
  })

  it('charges more for a more autonomous pattern, all else equal', () => {
    const supervised = assess(archetypeInput('payment-exception'))
    const bounded = assess(archetypeInput('ops-setup'))
    expect(supervised.autonomy.level).toBe(3)
    expect(bounded.autonomy.level).toBe(4)
    expect(bounded.investment.effortWeeks.mid).toBeGreaterThan(0)
  })

  it('charges for a gap when the recommended pattern is held constant', () => {
    const ready = archetypeInput('ops-setup')
    // Data sensitivity adds handling work without moving the autonomy level.
    const sensitive = writeDimension(ready, 'risk.dataSensitivity', 4)
    expect(assess(sensitive).autonomy.level).toBe(assess(ready).autonomy.level)
    expect(assess(sensitive).investment.effortWeeks.mid).toBeGreaterThan(
      assess(ready).investment.effortWeeks.mid,
    )
    expect(assess(sensitive).investment.drivers.map((d) => d.label)).toContain('Data handling')
  })

  it('prices the recommended pattern, not a fixed capability target', () => {
    // Removing system access does not make the same system cheaper to build —
    // it changes what the model recommends building, to something far smaller.
    // The estimate follows the recommendation, which is the only figure a reader
    // could act on.
    const ready = archetypeInput('ops-setup')
    const noAccess = writeDimension(ready, 'systems.systemAccess', 1)
    expect(assess(ready).autonomy.level).toBe(4)
    expect(assess(noAccess).autonomy.level).toBe(1)
    expect(assess(noAccess).investment.effortWeeks.mid).toBeLessThan(
      assess(ready).investment.effortWeeks.mid,
    )
    // ...but the integration debt is still named, so nobody reads it as free.
    expect(assess(noAccess).investment.drivers.map((d) => d.label)).toContain('Integration')
  })

  it('names integration when access is the gap, and does not otherwise', () => {
    const gapped = writeDimension(archetypeInput('ops-setup'), 'systems.systemAccess', 1)
    const labels = assess(gapped).investment.drivers.map((d) => d.label)
    expect(labels).toContain('Integration')
    expect(assess(archetypeInput('ops-setup')).investment.drivers.map((d) => d.label)).not.toContain(
      'Integration',
    )
  })

  it('grounds every driver in the input that caused it', () => {
    const gapped = writeDimension(archetypeInput('ops-setup'), 'systems.verification', 1)
    const driver = assess(gapped).investment.drivers.find((d) => d.label === 'Verification')!
    expect(driver.because).toMatch(/\d\/5/)
  })

  it('reports payback only when both cost figures are supplied', () => {
    expect(assess(withCost('payment-exception', 4000)).investment.paybackMonths).not.toBeNull()
    expect(assess(withCost('payment-exception', null)).investment.paybackMonths).toBeNull()

    const noHourly = withCost('payment-exception', 4000)
    noHourly.economics.loadedHourlyCost = null
    expect(assess(noHourly).investment.paybackMonths).toBeNull()
  })

  it('falls back to a currency-free return ratio when cost is unknown', () => {
    const r = assess(withCost('payment-exception', null))
    expect(r.investment.returnRatio).toBeGreaterThan(0)
    expect(r.investment.headline).toMatch(/hours a year per week invested/)
  })

  it('subtracts ongoing upkeep from the value before computing payback', () => {
    const r = assess(withCost('payment-exception', 4000))
    expect(r.investment.maintenanceWeeksPerYear).toBeGreaterThan(0)
    const naive = (r.investment.buildCost! / r.capacity.annual.capacityValue!) * 12
    expect(r.investment.paybackMonths!).toBeGreaterThan(naive)
  })

  it('refuses a payback figure when upkeep exceeds the value returned', () => {
    const r = assess(withCost('payment-exception', 100_000))
    expect(r.investment.paybackMonths).toBeNull()
    expect(r.investment.repaysFromCapacity).toBe(false)
    expect(r.investment.verdict).toBe('unfavourable')
    expect(r.investment.headline).toMatch(/never repaid/i)
  })

  it('distinguishes "cannot tell" from "does not repay"', () => {
    const unknown = assess(withCost('payment-exception', null))
    expect(unknown.investment.paybackMonths).toBeNull()
    expect(unknown.investment.repaysFromCapacity).toBe(true)

    const doesNot = assess(withCost('payment-exception', 100_000))
    expect(doesNot.investment.paybackMonths).toBeNull()
    expect(doesNot.investment.repaysFromCapacity).toBe(false)
  })

  it('never lets the currency-free ratio overrule a cost figure the user supplied', () => {
    const r = assess(withCost('support-triage', 400_000))
    expect(r.investment.returnRatio).toBeGreaterThan(50)
    expect(r.investment.verdict).toBe('unfavourable')
  })

  it('produces a finite, sane estimate for every archetype', () => {
    for (const a of ARCHETYPES) {
      const r = assess(archetypeInput(a.id))
      expect(Number.isFinite(r.investment.effortWeeks.mid)).toBe(true)
      expect(r.investment.effortWeeks.mid).toBeGreaterThanOrEqual(0)
      expect(r.investment.effortWeeks.mid).toBeLessThan(120)
      expect(r.investment.headline.length).toBeGreaterThan(5)
      expect(r.investment.note.length).toBeGreaterThan(20)
    }
  })
})

describe('classification accounts for what a build costs', () => {
  it('withholds "build now" when the effort is not repaid', () => {
    const expensive = withCost('support-triage', 400_000)
    const r = assess(expensive)
    expect(r.investment.verdict).toBe('unfavourable')
    expect(r.classification.id).not.toBe('build-now')
  })

  it('still recommends building when the return is there', () => {
    const r = assess(withCost('support-triage', 4000))
    expect(r.investment.verdict).not.toBe('unfavourable')
    expect(r.classification.id).toBe('build-now')
  })
})

/* ------------------------------------------------------------------ *
 * Uncertainty
 * ------------------------------------------------------------------ */

describe('score uncertainty', () => {
  it('reports no band once every dimension has been reviewed', () => {
    const u = computeUncertainty(record(archetypeInput('payment-exception'), [...ALL_DIMENSION_KEYS]))
    expect(u.unreviewedCount).toBe(0)
    expect(u.band).toBe(0)
    expect(u.recommendationStable).toBe(true)
    expect(u.summary).toMatch(/every dimension has been reviewed/i)
  })

  it('widens the band as fewer dimensions are reviewed', () => {
    const none = computeUncertainty(record(archetypeInput('custom'), []))
    const some = computeUncertainty(record(archetypeInput('custom'), ALL_DIMENSION_KEYS.slice(0, 14)))
    expect(none.band).toBeGreaterThan(some.band)
  })

  it('combines in quadrature, not by summing — the band stays interpretable', () => {
    const u = computeUncertainty(record(archetypeInput('custom'), []))
    const naive = u.contributors.reduce((sum, c) => sum + c.swing, 0)
    expect(u.band).toBeLessThan(naive)
    expect(u.band).toBeGreaterThan(0)
  })

  it('keeps the band inside the score range', () => {
    for (const a of ARCHETYPES) {
      const u = computeUncertainty(record(archetypeInput(a.id), []))
      expect(u.low).toBeGreaterThanOrEqual(0)
      expect(u.high).toBeLessThanOrEqual(100)
      expect(u.low).toBeLessThanOrEqual(u.high)
    }
  })

  it('flags when an unreviewed dimension could change the recommendation', () => {
    // Sitting exactly on a gate boundary: verification 4 is the bounded gate.
    let input = archetypeInput('ops-setup')
    input = writeDimension(input, 'systems.verification', 4 as Score)
    const u = computeUncertainty(record(input, []))
    expect(u.recommendationStable).toBe(false)
    expect(u.volatile.some((v) => v.key === 'systems.verification')).toBe(true)
    expect(u.summary).toMatch(/not settled/i)
  })

  it('says so plainly when the conclusion holds regardless of the presets', () => {
    const u = computeUncertainty(record(archetypeInput('compliance-review'), []))
    if (u.recommendationStable) expect(u.summary).toMatch(/holds even if the presets are wrong/i)
  })
})

/* ------------------------------------------------------------------ *
 * Combined unlock
 * ------------------------------------------------------------------ */

describe('combined unlock', () => {
  it('answers the question single-dimension analysis cannot', () => {
    // Scheduling is held by three gates capping at the same level, all of them
    // things an organisation can actually build.
    const input = archetypeInput('scheduling')
    const s = computeSensitivity(input)
    expect(s.entries.every((e) => e.unlock === null)).toBe(true)
    expect(s.combined).not.toBeNull()
    expect(s.combined!.reachable).toBe(true)
    expect(s.combined!.level).toBeGreaterThan(assess(input).autonomy.level)
    expect(s.combined!.moves.length).toBeGreaterThan(1)
    expect(s.combined!.moves.every((m) => DIMENSION_BY_KEY[m.key].nature === 'capability')).toBe(true)
  })

  it('reports a structural ceiling rather than proposing the impossible', () => {
    // Payment exception can only reach bounded execution if the decision stops
    // being regulated. That is not an improvement anyone can fund, so the
    // combination is reported as unreachable with the reason named.
    const s = computeSensitivity(archetypeInput('payment-exception'))
    expect(s.combined).not.toBeNull()
    expect(s.combined!.reachable).toBe(false)
    expect(s.combined!.blockedBy.map((b) => b.key)).toContain('risk.regulatorySensitivity')
    expect(s.combined!.moves.every((m) => DIMENSION_BY_KEY[m.key].nature === 'capability')).toBe(true)
  })

  it('reports moves that actually reach the level it claims', () => {
    const input = archetypeInput('payment-exception')
    const combined = computeSensitivity(input).combined!
    let moved = input
    for (const m of combined.moves) moved = writeDimension(moved, m.key, m.to as Score)
    expect(assess(moved).autonomy.level).toBe(combined.level)
  })

  it('stays silent when a single dimension already unlocks', () => {
    const input = writeDimension(archetypeInput('ops-setup'), 'systems.verification', 3 as Score)
    const s = computeSensitivity(input)
    if (s.entries.some((e) => e.unlock !== null)) expect(s.combined).toBeNull()
  })

  it('counts steps as a proxy for effort', () => {
    const combined = computeSensitivity(archetypeInput('payment-exception')).combined!
    const manual = combined.moves.reduce((n, m) => n + Math.abs(m.to - m.from), 0)
    expect(combined.steps).toBe(manual)
  })
})

describe('classification routes on return as well as readiness', () => {
  it('sends a slow-but-real return to de-risk first, not build now', () => {
    const r = assess(withCost('internal-approval', 4000))
    expect(r.investment.verdict).toBe('marginal')
    expect(r.readiness.level).toBe('production-candidate')
    expect(r.classification.id).toBe('de-risk-first')
  })

  it('sends a ready workflow with no return to low priority, not de-risk first', () => {
    const r = assess(withCost('scheduling', 4000))
    expect(r.investment.repaysFromCapacity).toBe(false)
    expect(r.classification.id).toBe('low-priority')
  })

  it('keeps de-risk first for an unready workflow, where groundwork may change the answer', () => {
    const r = assess(withCost('document-review', 4000))
    expect(r.investment.verdict).toBe('unfavourable')
    expect(r.readiness.level).toBe('discovery')
    expect(r.classification.id).not.toBe('low-priority')
  })

  it('reserves build now for a return that arrives soon enough to act on', () => {
    const r = assess(withCost('ops-setup', 4000))
    expect(r.investment.verdict).toBe('strong')
    expect(r.classification.id).toBe('build-now')
  })
})

/* ------------------------------------------------------------------ *
 * Capability vs constraint
 * ------------------------------------------------------------------ */

const natureOf = (k: string) => DIMENSION_BY_KEY[k as DimensionKey].nature

describe('capability and constraint are held apart', () => {
  it('classifies every dimension as one or the other', () => {
    for (const d of DIMENSIONS) {
      expect(['capability', 'constraint']).toContain(d.nature)
    }
  })

  it('treats what you build as capability and what the work is as constraint', () => {
    // You can fund these.
    for (const k of [
      'systems.systemAccess', 'systems.toolingReadiness', 'systems.observability',
      'systems.verification', 'systems.permissionComplexity', 'risk.reversibility',
      'oversight.escalationAvailability', 'oversight.feedbackAvailability',
    ]) expect(natureOf(k)).toBe('capability')

    // You cannot decide any of these.
    for (const k of [
      'risk.failureConsequence', 'risk.regulatorySensitivity', 'risk.dataSensitivity',
      'structure.humanJudgment', 'structure.contextBreadth', 'economics.variability',
    ]) expect(natureOf(k)).toBe('constraint')
  })

  it('never ranks a constraint as a leverage improvement', () => {
    for (const a of ARCHETYPES) {
      const s = computeSensitivity(archetypeInput(a.id))
      for (const e of [...s.highest, ...s.lowest]) {
        expect(e.nature).toBe('capability')
      }
    }
  })

  it('no longer tells a regulated workflow to become less regulated', () => {
    // The pre-fix behaviour: "Regulatory sensitivity 4 → 3" was the single
    // highest-leverage suggestion for this workflow.
    const s = computeSensitivity(archetypeInput('access-provisioning'))
    expect(s.highest.map((e) => e.key)).not.toContain('risk.regulatorySensitivity')
    expect(s.highest.map((e) => e.key)).not.toContain('structure.humanJudgment')
  })

  it('still surfaces load-bearing constraints, as explanation rather than advice', () => {
    const s = computeSensitivity(archetypeInput('compliance-review'))
    expect(s.constraints.length).toBeGreaterThan(0)
    expect(s.constraints.every((e) => e.nature === 'constraint')).toBe(true)
  })

  it('keeps constraints out of the highest list even when they dominate the model', () => {
    const s = computeSensitivity(archetypeInput('compliance-review'))
    const judgment = s.entries.find((e) => e.key === 'structure.humanJudgment')!
    // It is the most load-bearing dimension in this assessment...
    expect(judgment.leverage).toBeGreaterThan(s.highest[0]?.leverage ?? 0)
    // ...and it is still not offered as something to improve.
    expect(s.highest).not.toContain(judgment)
    expect(s.constraints).toContain(judgment)
  })
})

describe('the path to greater autonomy tells the truth about what it asks for', () => {
  it('tags every requirement as capability or constraint', () => {
    for (const id of ['payment-exception', 'access-provisioning', 'support-triage', 'monitoring']) {
      for (const step of assess(archetypeInput(id)).path.steps) {
        for (const r of step.requirements) {
          expect(r.nature).toBe(DIMENSION_BY_KEY[r.key].nature)
        }
      }
    }
  })

  it('names each dimension once, however many gates ask for it', () => {
    for (const a of ARCHETYPES) {
      const keys = assess(archetypeInput(a.id)).path.steps.flatMap((s) =>
        s.requirements.map((r) => r.key),
      )
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('marks a path as structural when nothing on it can be built', () => {
    // The only thing standing between access provisioning and bounded execution
    // is that the decision is regulated. That is not a roadmap.
    const path = assess(archetypeInput('access-provisioning')).path
    expect(path.steps.flatMap((s) => s.requirements).every((r) => r.nature === 'constraint')).toBe(true)
    expect(path.structural).toBe(true)
  })

  it('does not call a path structural when there is real work in it', () => {
    const path = assess(archetypeInput('payment-exception')).path
    expect(path.steps.flatMap((s) => s.requirements).some((r) => r.nature === 'capability')).toBe(true)
    expect(path.structural).toBe(false)
  })

  it('never reports a structural path with nothing on it', () => {
    for (const a of ARCHETYPES) {
      const path = assess(archetypeInput(a.id)).path
      if (path.structural) expect(path.steps.length).toBeGreaterThan(0)
    }
  })
})

describe('leverage counts upside only', () => {
  it('never ranks a move that lowers the score as an improvement', () => {
    for (const a of ARCHETYPES) {
      const s = computeSensitivity(archetypeInput(a.id))
      for (const e of s.highest) {
        // A listed improvement must actually improve something.
        expect(e.fitUpside > 0 || e.unlock !== null || e.blocksLevel !== null || e.capacityUpside > 0).toBe(true)
      }
    }
  })

  it('still records the real direction, including when structuring inputs lowers fit', () => {
    // More structured inputs make a model less necessary, so fit falls even as
    // capacity rises. That is the model working; the number is kept, and the
    // dimension only earns its place in the ranking through the capacity.
    const s = computeSensitivity(archetypeInput('access-provisioning'))
    const listed = s.highest.find((e) => e.key === 'structure.inputStructure')
    const entry = s.entries.find((e) => e.key === 'structure.inputStructure')!
    expect(entry.fitUpside).toBeLessThan(0)
    if (listed) {
      expect(listed.capacityUpside).toBeGreaterThan(0)
      expect(listed.leverage).toBeGreaterThan(0)
    }
  })

  it('drops a dimension from the ranking when it offers no upside of any kind', () => {
    for (const a of ARCHETYPES) {
      for (const e of computeSensitivity(archetypeInput(a.id)).highest) {
        expect(e.leverage).toBeGreaterThan(0)
      }
    }
  })

  it('orders improvements by leverage, descending', () => {
    const s = computeSensitivity(archetypeInput('client-onboarding'))
    const values = s.highest.map((e) => e.leverage)
    expect(values).toEqual(values.toSorted((x, y) => y - x))
  })
})

describe('the leverage lists are disjoint', () => {
  it('never names the same dimension as both highest and lowest leverage', () => {
    for (const a of ARCHETYPES) {
      const s = computeSensitivity(archetypeInput(a.id))
      const high = new Set(s.highest.map((e) => e.key))
      for (const e of s.lowest) expect(high.has(e.key)).toBe(false)
    }
  })

  it('holds even when there are barely any investable dimensions left', () => {
    // Push every capability to its best value so almost nothing is movable.
    let input = archetypeInput('reconciliation')
    for (const d of DIMENSIONS) {
      if (d.nature !== 'capability') continue
      input = writeDimension(input, d.key, (d.polarity === 'raises' ? 5 : 1) as Score)
    }
    const s = computeSensitivity(input)
    const high = new Set(s.highest.map((e) => e.key))
    for (const e of s.lowest) expect(high.has(e.key)).toBe(false)
  })
})
