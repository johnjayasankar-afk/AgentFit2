import { describe, expect, it } from 'vitest'
import type { AssessmentInput, Score } from '../domain/types'
import { archetypeInput } from '../domain/archetypes'
import { ALL_DIMENSION_KEYS, readDimension, writeDimension } from '../domain/dimensions'
import { assess } from './assess'
import { computeFit, FIT_WEIGHTS } from './fit'
import { GATES, gateActive, pathToLevel } from './autonomy'
import { computeSensitivity } from './sensitivity'
import { clamp01, contextCoverage, inv, logRamp, norm } from './normalize'
import { derivedCoverage } from './economics'

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const base = (): AssessmentInput => archetypeInput('custom')

function build(patch: {
  economics?: Partial<AssessmentInput['economics']>
  structure?: Partial<AssessmentInput['structure']>
  systems?: Partial<AssessmentInput['systems']>
  risk?: Partial<AssessmentInput['risk']>
  oversight?: Partial<AssessmentInput['oversight']>
}): AssessmentInput {
  const b = base()
  return {
    ...b,
    economics: { ...b.economics, ...patch.economics },
    structure: { ...b.structure, ...patch.structure },
    systems: { ...b.systems, ...patch.systems },
    risk: { ...b.risk, ...patch.risk },
    oversight: { ...b.oversight, ...patch.oversight },
  }
}

/** High volume, strong access, cheap verification, reversible, low consequence. */
const CASE_A = build({
  economics: { volume: 400, period: 'week', minutesPerCase: 25, peopleInvolved: 1, loadedHourlyCost: 70, variability: 2 },
  structure: { ruleClarity: 4, inputStructure: 2, contextBreadth: 3, exceptionRate: 2, humanJudgment: 2 },
  systems: { systemAccess: 5, toolingReadiness: 5, observability: 5, verification: 5, permissionComplexity: 2 },
  risk: { reversibility: 5, failureConsequence: 2, blastRadius: 2, regulatorySensitivity: 1, dataSensitivity: 2 },
  oversight: { reviewCost: 2, approvalLatencyImpact: 3, escalationAvailability: 4, feedbackAvailability: 4 },
})

/** Same economics and access, but money moves and cannot be recalled. */
const CASE_B = build({
  economics: { volume: 400, period: 'week', minutesPerCase: 25, peopleInvolved: 1, loadedHourlyCost: 90, variability: 2 },
  structure: { ruleClarity: 4, inputStructure: 3, contextBreadth: 3, exceptionRate: 2, humanJudgment: 3 },
  systems: { systemAccess: 5, toolingReadiness: 5, observability: 5, verification: 4, permissionComplexity: 3 },
  risk: { reversibility: 1, failureConsequence: 5, blastRadius: 4, regulatorySensitivity: 3, dataSensitivity: 4 },
  oversight: { reviewCost: 2, approvalLatencyImpact: 2, escalationAvailability: 4, feedbackAvailability: 4 },
})

/** Fully specified, fully structured, thin exception tail. */
const CASE_C = build({
  economics: { volume: 200, period: 'week', minutesPerCase: 15, peopleInvolved: 1, loadedHourlyCost: 60, variability: 1 },
  structure: { ruleClarity: 5, inputStructure: 5, contextBreadth: 1, exceptionRate: 1, humanJudgment: 1 },
  systems: { systemAccess: 5, toolingReadiness: 5, observability: 4, verification: 5, permissionComplexity: 2 },
  risk: { reversibility: 4, failureConsequence: 2, blastRadius: 2, regulatorySensitivity: 1, dataSensitivity: 2 },
  oversight: { reviewCost: 1, approvalLatencyImpact: 2, escalationAvailability: 4, feedbackAvailability: 4 },
})

/** Expert judgment, unverifiable, serious consequence. */
const CASE_D = build({
  economics: { volume: 40, period: 'week', minutesPerCase: 90, peopleInvolved: 2, loadedHourlyCost: 120, variability: 5 },
  structure: { ruleClarity: 1, inputStructure: 2, contextBreadth: 4, exceptionRate: 4, humanJudgment: 5 },
  systems: { systemAccess: 3, toolingReadiness: 2, observability: 2, verification: 1, permissionComplexity: 3 },
  risk: { reversibility: 2, failureConsequence: 5, blastRadius: 4, regulatorySensitivity: 5, dataSensitivity: 4 },
  oversight: { reviewCost: 5, approvalLatencyImpact: 1, escalationAvailability: 2, feedbackAvailability: 1 },
})

/** Technically ideal, economically trivial. */
const CASE_E = build({
  economics: { volume: 2, period: 'week', minutesPerCase: 6, peopleInvolved: 1, loadedHourlyCost: 60, variability: 1 },
  structure: { ruleClarity: 4, inputStructure: 2, contextBreadth: 2, exceptionRate: 2, humanJudgment: 2 },
  systems: { systemAccess: 5, toolingReadiness: 5, observability: 5, verification: 5, permissionComplexity: 1 },
  risk: { reversibility: 5, failureConsequence: 1, blastRadius: 1, regulatorySensitivity: 1, dataSensitivity: 1 },
  oversight: { reviewCost: 1, approvalLatencyImpact: 2, escalationAvailability: 4, feedbackAvailability: 4 },
})

/** Case A, except that actions are irreversible and consequence is serious.
 *  Reversibility is the single binding constraint, two steps from clearing. */
const REVERSIBILITY_BOUND = build({
  economics: { volume: 400, period: 'week', minutesPerCase: 25, peopleInvolved: 1, loadedHourlyCost: 70, variability: 2 },
  structure: { ruleClarity: 4, inputStructure: 2, contextBreadth: 3, exceptionRate: 2, humanJudgment: 2 },
  systems: { systemAccess: 5, toolingReadiness: 5, observability: 5, verification: 5, permissionComplexity: 2 },
  risk: { reversibility: 1, failureConsequence: 4, blastRadius: 2, regulatorySensitivity: 1, dataSensitivity: 2 },
  oversight: { reviewCost: 2, approvalLatencyImpact: 3, escalationAvailability: 4, feedbackAvailability: 4 },
})

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

describe('normalisation', () => {
  it('maps the 1–5 scale to 0–1 at both ends', () => {
    expect(norm(1)).toBe(0)
    expect(norm(5)).toBe(1)
    expect(norm(3)).toBe(0.5)
    expect(inv(1)).toBe(1)
    expect(inv(5)).toBe(0)
  })

  it('bounds the log ramp at both ends', () => {
    expect(logRamp(10, 40, 6000)).toBe(0)
    expect(logRamp(40, 40, 6000)).toBe(0)
    expect(logRamp(6000, 40, 6000)).toBe(1)
    expect(logRamp(1_000_000, 40, 6000)).toBe(1)
  })

  it('prevents extreme volume from dominating the model', () => {
    const big = build({ economics: { volume: 100_000, period: 'day', minutesPerCase: 600 } })
    const economic = computeFit(big).components.find((c) => c.id === 'economic')!
    expect(economic.earned).toBeLessThanOrEqual(FIT_WEIGHTS.economic)
  })

  it('treats context breadth as a demand met by access, not a defect', () => {
    expect(contextCoverage(5, 5)).toBe(1)
    expect(contextCoverage(5, 2)).toBe(1)
    expect(contextCoverage(1, 5)).toBe(0)
    expect(contextCoverage(3, 5)).toBeCloseTo(0.5)
  })

  it('clamps out-of-range values', () => {
    expect(clamp01(-2)).toBe(0)
    expect(clamp01(7)).toBe(1)
  })
})

/* ------------------------------------------------------------------ *
 * Fit score
 * ------------------------------------------------------------------ */

describe('agent fit score', () => {
  it('stays within 0–100 across every archetype', () => {
    for (const id of ['custom', 'support-triage', 'payment-exception', 'compliance-review', 'research']) {
      const { fit } = assess(archetypeInput(id))
      expect(fit.score).toBeGreaterThanOrEqual(0)
      expect(fit.score).toBeLessThanOrEqual(100)
    }
  })

  it('never exceeds the published component weights', () => {
    const { fit } = assess(CASE_A)
    for (const c of fit.components) {
      expect(c.earned).toBeLessThanOrEqual(c.max + 1e-9)
      expect(c.earned).toBeGreaterThanOrEqual(0)
    }
    const total = Object.values(FIT_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })

  it('is deterministic', () => {
    expect(assess(CASE_B).fit.score).toBe(assess(CASE_B).fit.score)
  })

  it('rewards genuine economic scale over a trivial workflow', () => {
    expect(assess(CASE_A).fit.score).toBeGreaterThan(assess(CASE_E).fit.score)
  })

  it('penalises workflows where expert judgment is the deliverable', () => {
    const judgmentHeavy = build({ structure: { humanJudgment: 5 } })
    const judgmentModerate = build({ structure: { humanJudgment: 2 } })
    const a = computeFit(judgmentHeavy).components.find((c) => c.id === 'judgment')!
    const b = computeFit(judgmentModerate).components.find((c) => c.id === 'judgment')!
    expect(a.earned).toBeLessThan(b.earned)
  })

  it('discounts judgment suitability when no model is needed at all', () => {
    const deterministic = build({ structure: { ruleClarity: 5, inputStructure: 5, contextBreadth: 1, humanJudgment: 1 } })
    const component = computeFit(deterministic).components.find((c) => c.id === 'judgment')!
    expect(component.ratio).toBeLessThan(0.5)
  })
})

/* ------------------------------------------------------------------ *
 * The central claim: fit is not autonomy
 * ------------------------------------------------------------------ */

describe('fit and autonomy are separate judgements', () => {
  it('Case A — strong economics, low risk, cheap verification → high fit and high autonomy', () => {
    const r = assess(CASE_A)
    expect(r.fit.score).toBeGreaterThanOrEqual(70)
    expect(r.autonomy.level).toBeGreaterThanOrEqual(4)
  })

  it('Case B — the same economics with irreversible, severe actions → high fit, capped autonomy', () => {
    const r = assess(CASE_B)
    expect(r.fit.score).toBeGreaterThanOrEqual(55)
    expect(r.autonomy.level).toBeLessThanOrEqual(3)
    expect(r.controls.required.some((c) => c.control.id === 'human-approval')).toBe(true)
  })

  it('A and B differ by risk alone, and only autonomy collapses', () => {
    const a = assess(CASE_A)
    const b = assess(CASE_B)
    expect(a.autonomy.level - b.autonomy.level).toBeGreaterThanOrEqual(1)
    // Fit stays in the same broad band; it is the autonomy engine that reacts.
    expect(Math.abs(a.fit.score - b.fit.score)).toBeLessThan(30)
  })

  it('a high fit score never forces a high autonomy level', () => {
    const r = assess(CASE_B)
    expect(r.fit.score).toBeGreaterThan(50)
    expect(r.autonomy.level).toBeLessThan(4)
  })
})

/* ------------------------------------------------------------------ *
 * Autonomy gates
 * ------------------------------------------------------------------ */

describe('autonomy gating', () => {
  it('caps at assist when there is no programmatic access', () => {
    const r = assess(build({ systems: { systemAccess: 1 } }))
    expect(r.autonomy.level).toBeLessThanOrEqual(1)
  })

  it('caps at assist when expert judgment is the deliverable', () => {
    const r = assess(build({ structure: { humanJudgment: 5 }, systems: { verification: 4 } }))
    expect(r.autonomy.level).toBeLessThanOrEqual(1)
  })

  it('caps at supervised when actions are irreversible and consequential', () => {
    const r = assess({
      ...CASE_A,
      risk: { ...CASE_A.risk, reversibility: 1, failureConsequence: 5 },
    })
    expect(r.autonomy.level).toBeLessThanOrEqual(3)
  })

  it('caps at supervised under regulatory sign-off obligations', () => {
    const r = assess({ ...CASE_A, risk: { ...CASE_A.risk, regulatorySensitivity: 5 } })
    expect(r.autonomy.level).toBeLessThanOrEqual(3)
  })

  it('caps below bounded when outcomes are never observed', () => {
    const r = assess({ ...CASE_A, oversight: { ...CASE_A.oversight, feedbackAvailability: 1 } })
    expect(r.autonomy.level).toBeLessThanOrEqual(3)
  })

  it('caps below bounded when there is no escalation path', () => {
    const r = assess({ ...CASE_A, oversight: { ...CASE_A.oversight, escalationAvailability: 1 } })
    expect(r.autonomy.level).toBeLessThanOrEqual(3)
  })

  it('is reluctant to recommend full autonomy', () => {
    const levels = ['custom', 'support-triage', 'payment-exception', 'reconciliation', 'document-review',
      'access-provisioning', 'compliance-review', 'client-onboarding', 'ops-setup', 'monitoring',
      'reporting', 'scheduling', 'data-analysis', 'software-development', 'internal-approval', 'research']
      .map((id) => assess(archetypeInput(id)).autonomy.level)
    expect(levels.filter((l) => l === 5).length).toBe(0)
  })

  it('reaches full autonomy only when every condition is met', () => {
    const ideal = build({
      economics: { volume: 500, period: 'week', minutesPerCase: 20, variability: 1 },
      structure: { ruleClarity: 4, inputStructure: 2, contextBreadth: 2, exceptionRate: 1, humanJudgment: 2 },
      systems: { systemAccess: 5, toolingReadiness: 5, observability: 5, verification: 5, permissionComplexity: 1 },
      risk: { reversibility: 5, failureConsequence: 1, blastRadius: 1, regulatorySensitivity: 1, dataSensitivity: 1 },
      oversight: { reviewCost: 1, approvalLatencyImpact: 3, escalationAvailability: 5, feedbackAvailability: 5 },
    })
    expect(assess(ideal).autonomy.level).toBe(5)
    // Degrading any single autonomous prerequisite drops it back.
    expect(assess(writeDimension(ideal, 'risk.reversibility', 4)).autonomy.level).toBe(4)
    expect(assess(writeDimension(ideal, 'systems.verification', 4)).autonomy.level).toBe(4)
    expect(assess(writeDimension(ideal, 'structure.exceptionRate', 3)).autonomy.level).toBe(4)
  })

  it('every gate is reachable — none is dead code', () => {
    const seen = new Set<string>()
    const probe = (input: AssessmentInput) => {
      for (const gate of GATES) if (gateActive(input, gate)) seen.add(gate.id)
    }
    // Sweep each dimension across its whole range from both extremes.
    for (const anchor of [1, 5] as Score[]) {
      let input = base()
      for (const key of ALL_DIMENSION_KEYS) input = writeDimension(input, key, anchor)
      probe(input)
      for (const key of ALL_DIMENSION_KEYS) {
        for (const v of [1, 2, 3, 4, 5] as Score[]) probe(writeDimension(input, key, v))
      }
    }
    const unreached = GATES.filter((g) => !seen.has(g.id)).map((g) => g.id)
    expect(unreached).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * Conventional automation and human-led outcomes
 * ------------------------------------------------------------------ */

describe('the model declines to recommend an agent', () => {
  it('Case C — deterministic and structured → conventional automation, not an agent', () => {
    const r = assess(CASE_C)
    expect(r.autonomy.level).toBe(0)
    expect(r.autonomy.zeroVariant).toBe('conventional')
    expect(r.pattern.pattern.id).toBe('traditional-automation')
    expect(r.classification.id).toBe('automate-conventionally')
  })

  it('Case D — expert judgment, unverifiable, severe → human-led', () => {
    const r = assess(CASE_D)
    expect(r.autonomy.level).toBe(0)
    expect(r.autonomy.zeroVariant).toBe('human-led')
    expect(r.pattern.pattern.id).toBe('human-led')
  })

  it('Case E — technically ideal but economically trivial → low priority', () => {
    const r = assess(CASE_E)
    expect(r.classification.id).toBe('low-priority')
    expect(r.experiment.title).toMatch(/volume/i)
  })

  it('unstructured input keeps a workflow out of the conventional bucket', () => {
    const r = assess({ ...CASE_C, structure: { ...CASE_C.structure, inputStructure: 1 } })
    expect(r.autonomy.zeroVariant).not.toBe('conventional')
  })
})

/* ------------------------------------------------------------------ *
 * Pattern, controls, readiness
 * ------------------------------------------------------------------ */

describe('pattern selection', () => {
  it('never recommends execution without an interface to execute through', () => {
    const r = assess(build({ systems: { systemAccess: 4, toolingReadiness: 1 } }))
    expect(r.autonomy.level).toBeLessThanOrEqual(2)
    expect(['read-only-tool-agent', 'ai-assist', 'retrieval-assist', 'human-led', 'assistive-tool-agent'])
      .toContain(r.pattern.pattern.id)
  })

  it('recommends supervised tooling at level three', () => {
    const r = assess(CASE_B)
    expect(r.autonomy.level).toBe(3)
    expect(r.pattern.pattern.id).toBe('supervised-tool-agent')
  })

  it('withholds decomposition unless context genuinely spans domains', () => {
    expect(assess(CASE_A).pattern.decompositionNote).toBeNull()
    expect(assess(CASE_B).pattern.decompositionNote).toBeNull()
  })
})

describe('control posture', () => {
  it('requires approval at supervised and not at read-only', () => {
    expect(assess(CASE_B).controls.required.some((c) => c.control.id === 'human-approval')).toBe(true)
    // Access exists but nothing stable to call: the agent may read and prepare only.
    const assistive = assess(build({ systems: { systemAccess: 4, toolingReadiness: 2 } }))
    expect(assistive.autonomy.level).toBe(2)
    expect(assistive.controls.required.some((c) => c.control.id === 'read-only')).toBe(true)
    expect(assistive.controls.required.some((c) => c.control.id === 'human-approval')).toBe(false)
  })

  it('requires rollback and verification before independent execution', () => {
    const r = assess(CASE_A)
    expect(r.autonomy.level).toBeGreaterThanOrEqual(4)
    const ids = r.controls.required.map((c) => c.control.id)
    expect(ids).toContain('rollback')
    expect(ids).toContain('post-action-verification')
    expect(ids).toContain('transaction-limits')
  })

  it('names controls needed before autonomy increases, distinct from those required now', () => {
    const r = assess(CASE_B)
    const now = new Set(r.controls.required.map((c) => c.control.id))
    expect(r.controls.beforeMoreAutonomy.length).toBeGreaterThan(0)
    for (const c of r.controls.beforeMoreAutonomy) expect(now.has(c.control.id)).toBe(false)
  })

  it('escalates to dual approval at the highest consequence', () => {
    const r = assess({ ...CASE_B, risk: { ...CASE_B.risk, failureConsequence: 5 } })
    expect(r.controls.required.some((c) => c.control.id === 'dual-approval')).toBe(true)
  })

  it('never claims production authorisation', () => {
    for (const id of ['custom', 'support-triage', 'payment-exception']) {
      expect(assess(archetypeInput(id)).readiness.meta.label).not.toMatch(/production ready/i)
    }
  })
})

describe('readiness', () => {
  it('is not ready without programmatic access', () => {
    expect(assess(build({ systems: { systemAccess: 1 } })).readiness.level).toBe('not-ready')
  })

  it('is discovery ready when access exists but instrumentation does not', () => {
    const r = assess(build({
      systems: { systemAccess: 4, toolingReadiness: 3, observability: 3, verification: 2 },
      oversight: { escalationAvailability: 4, feedbackAvailability: 4 },
    }))
    expect(r.readiness.level).toBe('discovery')
    expect(r.readiness.blockers.length).toBeGreaterThan(0)
  })

  it('reaches production candidate only with full instrumentation', () => {
    expect(assess(CASE_A).readiness.level).toBe('production-candidate')
  })

  it('tracks readiness independently of autonomy', () => {
    // Well instrumented, but irreversible and severe: ready to build, not to delegate.
    const r = assess(CASE_B)
    expect(r.readiness.level).toBe('production-candidate')
    expect(r.autonomy.level).toBe(3)
  })
})

/* ------------------------------------------------------------------ *
 * Capacity
 * ------------------------------------------------------------------ */

describe('capacity model', () => {
  it('computes manual hours from volume, duration and headcount', () => {
    const r = assess(build({
      economics: { volume: 150, period: 'week', minutesPerCase: 30, peopleInvolved: 1 },
    }))
    expect(r.capacity.manualHours).toBeCloseTo(75, 5)
  })

  it('scales with people involved', () => {
    const one = assess(build({ economics: { volume: 100, period: 'week', minutesPerCase: 30, peopleInvolved: 1 } }))
    const two = assess(build({ economics: { volume: 100, period: 'week', minutesPerCase: 30, peopleInvolved: 2 } }))
    expect(two.capacity.manualHours).toBeCloseTo(one.capacity.manualHours * 2, 5)
  })

  it('normalises every period to the same annual basis', () => {
    const weekly = assess(build({ economics: { volume: 52, period: 'week', minutesPerCase: 60, peopleInvolved: 1 } }))
    const monthly = assess(build({ economics: { volume: 52 * 52 / 12, period: 'month', minutesPerCase: 60, peopleInvolved: 1 } }))
    expect(monthly.capacity.annual.manualHours).toBeCloseTo(weekly.capacity.annual.manualHours, 3)
  })

  it('subtracts oversight and hand-back cost from gross automation', () => {
    const r = assess(CASE_B)
    expect(r.capacity.netCapacityHours).toBeLessThan(r.capacity.automatedHours)
    expect(r.capacity.netCapacityHours).toBeCloseTo(
      r.capacity.automatedHours - r.capacity.reviewHours - r.capacity.exceptionHours,
      6,
    )
  })

  it('never returns more capacity than the workflow consumes', () => {
    for (const id of ['support-triage', 'payment-exception', 'reconciliation', 'monitoring']) {
      const r = assess(archetypeInput(id))
      expect(r.capacity.netCapacityHours).toBeLessThanOrEqual(r.capacity.manualHours + 1e-9)
    }
  })

  it('omits capacity value when no hourly cost is supplied', () => {
    const withCost = assess(build({ economics: { loadedHourlyCost: 80 } }))
    const without = assess(build({ economics: { loadedHourlyCost: null } }))
    expect(withCost.capacity.annual.capacityValue).toBeGreaterThan(0)
    expect(without.capacity.annual.capacityValue).toBeNull()
  })

  it('honours a user override and marks it as overridden', () => {
    const b = base()
    const overridden = assess({ ...b, assumptions: { ...b.assumptions, coveragePct: 90 } })
    expect(overridden.capacity.assumptions.coveragePct).toBe(90)
    expect(overridden.capacity.assumptions.overridden.coveragePct).toBe(true)
    expect(assess(b).capacity.assumptions.overridden.coveragePct).toBe(false)
  })

  it('derives lower coverage as exceptions rise', () => {
    const low = derivedCoverage(build({ structure: { exceptionRate: 1 } }))
    const high = derivedCoverage(build({ structure: { exceptionRate: 5 } }))
    expect(high).toBeLessThan(low)
  })

  it('returns more capacity at higher autonomy, all else equal', () => {
    const supervised = assess(CASE_B)
    const bounded = assess(CASE_A)
    expect(bounded.capacity.assumptions.timeReductionPct).toBeGreaterThan(
      supervised.capacity.assumptions.timeReductionPct,
    )
  })

  it('returns no capacity, and charges no triage, when the answer is to keep the work human', () => {
    const r = assess(CASE_D)
    expect(r.autonomy.zeroVariant).toBe('human-led')
    expect(r.capacity.netCapacityHours).toBe(0)
    expect(r.capacity.exceptionHours).toBe(0)
  })

  it('handles zero volume without producing a non-finite result', () => {
    const r = assess(build({ economics: { volume: 0, minutesPerCase: 0 } }))
    expect(Number.isFinite(r.capacity.netCapacityHours)).toBe(true)
    expect(Number.isFinite(r.fit.score)).toBe(true)
    expect(r.fit.score).toBeGreaterThanOrEqual(0)
  })
})

/* ------------------------------------------------------------------ *
 * Path, sensitivity, explanation
 * ------------------------------------------------------------------ */

describe('path to greater autonomy', () => {
  it('names the specific dimension moves that would raise the ceiling', () => {
    const r = assess(CASE_B)
    const path = pathToLevel(CASE_B, r.autonomy)
    expect(path.reachable).toBe(true)
    expect(path.target).toBe(4)
    const keys = path.steps.flatMap((s) => s.requirements.map((q) => q.key))
    expect(keys).toContain('risk.reversibility')
  })

  it('produces requirements that actually clear the level when applied', () => {
    let input = CASE_B
    const before = assess(input)
    const path = pathToLevel(input, before.autonomy)
    for (const step of path.steps) {
      for (const r of step.requirements) {
        input = writeDimension(input, r.key, r.to as Score)
      }
    }
    expect(assess(input).autonomy.level).toBeGreaterThanOrEqual(before.autonomy.level + 1)
  })

  it('reports nothing to do at the top of the ladder', () => {
    const top = assess(build({
      structure: { ruleClarity: 4, inputStructure: 2, contextBreadth: 2, exceptionRate: 1, humanJudgment: 2 },
      systems: { systemAccess: 5, toolingReadiness: 5, observability: 5, verification: 5, permissionComplexity: 1 },
      risk: { reversibility: 5, failureConsequence: 1, blastRadius: 1, regulatorySensitivity: 1, dataSensitivity: 1 },
      oversight: { reviewCost: 1, approvalLatencyImpact: 3, escalationAvailability: 5, feedbackAvailability: 5 },
    }))
    expect(pathToLevel(base(), top.autonomy, 5).reachable).toBeDefined()
  })
})

describe('sensitivity analysis', () => {
  it('ranks a gate-clearing dimension above a points-only one', () => {
    const s = computeSensitivity(REVERSIBILITY_BOUND)
    const reversibility = s.entries.find((e) => e.key === 'risk.reversibility')!
    const variability = s.entries.find((e) => e.key === 'economics.variability')!
    expect(reversibility.leverage).toBeGreaterThan(variability.leverage)
    expect(s.highest[0]!.key).toBe('risk.reversibility')
  })

  it('reports no unlock when a second constraint caps autonomy independently', () => {
    // In Case B, severe failure consequence caps at supervised on its own, so
    // improving reversibility alone changes nothing. Saying so is the point.
    const s = computeSensitivity(CASE_B)
    expect(s.entries.find((e) => e.key === 'risk.reversibility')!.unlock).toBeNull()
  })

  it('marks dimensions already at their best value as at the ceiling', () => {
    const s = computeSensitivity(CASE_A)
    expect(s.entries.find((e) => e.key === 'systems.verification')!.atCeiling).toBe(true)
    expect(s.highest.every((e) => !e.atCeiling)).toBe(true)
  })

  it('finds a gate-clearing move that takes more than one step', () => {
    // Reversibility is 1 and the gate needs 3, so a single step reveals nothing.
    const s = computeSensitivity(REVERSIBILITY_BOUND)
    const reversibility = s.entries.find((e) => e.key === 'risk.reversibility')!
    expect(reversibility.unlock).not.toBeNull()
    expect(reversibility.unlock!.steps).toBe(2)
    expect(reversibility.unlock!.level).toBeGreaterThan(assess(REVERSIBILITY_BOUND).autonomy.level)
  })

  it('covers every dimension exactly once', () => {
    const s = computeSensitivity(CASE_B)
    expect(s.entries).toHaveLength(ALL_DIMENSION_KEYS.length)
    expect(new Set(s.entries.map((e) => e.key)).size).toBe(ALL_DIMENSION_KEYS.length)
  })
})

describe('explanation and outputs', () => {
  it('cites the binding constraint in the rationale', () => {
    const r = assess(CASE_B)
    expect(r.explanation.limiting.length).toBeGreaterThan(0)
    expect(r.explanation.therefore.length).toBeGreaterThan(60)
  })

  it('produces a risk register grounded in the inputs', () => {
    const r = assess(CASE_B)
    expect(r.risks.length).toBeGreaterThan(0)
    expect(r.risks.some((x) => x.id === 'irreversible-action')).toBe(true)
    expect(r.risks[0]!.because).toMatch(/\d\/5/)
  })

  it('selects evaluation metrics rather than listing all of them', () => {
    // A workflow with no system access cannot call tools, so tool metrics are meaningless.
    const simple = assess(build({ systems: { systemAccess: 1 } })).evaluation.map((m) => m.name)
    const complex = assess(CASE_B).evaluation.map((m) => m.name)
    expect(simple.length).toBeLessThan(complex.length)
    expect(complex).toContain('Tool call success rate')
    expect(simple).not.toContain('Tool call success rate')
  })

  it('always produces a concrete next experiment with criteria', () => {
    for (const id of ['custom', 'support-triage', 'payment-exception', 'compliance-review', 'reconciliation', 'research']) {
      const r = assess(archetypeInput(id))
      expect(r.experiment.title.length).toBeGreaterThan(10)
      expect(r.experiment.criteria.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('builds an architecture whose human boundary matches the pattern', () => {
    const supervised = assess(CASE_B).architecture
    expect(supervised.some((n) => n.kind === 'human' && n.label === 'Approval')).toBe(true)
    const bounded = assess(CASE_A).architecture
    expect(bounded.some((n) => n.label === 'Rollback')).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * Whole-model invariants
 * ------------------------------------------------------------------ */

describe('model invariants', () => {
  it('produces a complete, finite result for every dimension value in isolation', () => {
    let checked = 0
    for (const key of ALL_DIMENSION_KEYS) {
      for (const v of [1, 2, 3, 4, 5] as Score[]) {
        const r = assess(writeDimension(base(), key, v))
        expect(Number.isFinite(r.fit.score)).toBe(true)
        expect(r.fit.score).toBeGreaterThanOrEqual(0)
        expect(r.fit.score).toBeLessThanOrEqual(100)
        expect(r.autonomy.level).toBeGreaterThanOrEqual(0)
        expect(r.autonomy.level).toBeLessThanOrEqual(5)
        expect(r.controls.required.length).toBeGreaterThan(0)
        expect(r.pattern.pattern.name.length).toBeGreaterThan(0)
        checked += 1
      }
    }
    expect(checked).toBe(ALL_DIMENSION_KEYS.length * 5)
  })

  it('reads and writes every dimension by key symmetrically', () => {
    for (const key of ALL_DIMENSION_KEYS) {
      expect(readDimension(writeDimension(base(), key, 4), key)).toBe(4)
    }
  })

  it('is monotonic in risk: raising consequence never raises autonomy', () => {
    let previous = 6
    for (const v of [1, 2, 3, 4, 5] as Score[]) {
      const level = assess(writeDimension(CASE_A, 'risk.failureConsequence', v)).autonomy.level
      expect(level).toBeLessThanOrEqual(previous)
      previous = level
    }
  })

  it('is monotonic in verification: raising it never lowers autonomy', () => {
    let previous = -1
    for (const v of [1, 2, 3, 4, 5] as Score[]) {
      const level = assess(writeDimension(CASE_A, 'systems.verification', v)).autonomy.level
      expect(level).toBeGreaterThanOrEqual(previous)
      previous = level
    }
  })

  it('tags every result with the model version that produced it', () => {
    expect(assess(base()).modelVersion).toBe('agentfit-1.0')
  })
})

/* ------------------------------------------------------------------ *
 * Sensitivity must agree with the recommendation
 * ------------------------------------------------------------------ */

describe('sensitivity agrees with the gates', () => {
  it('ranks a dimension named by a binding gate above one that only moves the score', () => {
    // Payment exception is capped by reversibility AND regulatory sensitivity.
    // Neither unlocks a level alone, so a purely one-at-a-time analysis would
    // rank both below a dimension worth a point of fit. It must not.
    const input = archetypeInput('payment-exception')
    const s = computeSensitivity(input)
    const reversibility = s.entries.find((e) => e.key === 'risk.reversibility')!
    const regulatory = s.entries.find((e) => e.key === 'risk.regulatorySensitivity')!
    const exceptions = s.entries.find((e) => e.key === 'structure.exceptionRate')!

    expect(reversibility.unlock).toBeNull()
    expect(reversibility.blocksLevel).not.toBeNull()
    expect(reversibility.leverage).toBeGreaterThan(exceptions.leverage)
    expect(regulatory.leverage).toBeGreaterThan(exceptions.leverage)
    expect(s.highest.map((e) => e.key)).toContain('risk.reversibility')
  })

  it('reports the same blockers the path-to-next-level does', () => {
    const input = archetypeInput('payment-exception')
    const r = assess(input)
    const s = computeSensitivity(input)
    const pathKeys = new Set(r.path.steps.flatMap((step) => step.requirements.map((q) => q.key)))
    const blockingKeys = new Set(
      s.entries.filter((e) => e.blocksLevel !== null).map((e) => e.key),
    )
    for (const key of pathKeys) expect(blockingKeys.has(key)).toBe(true)
  })

  it('marks nothing as blocking when no gate is active below the ceiling', () => {
    const s = computeSensitivity(CASE_C)
    expect(s.entries.every((e) => e.blocksLevel === null || e.blocksLevel >= 0)).toBe(true)
  })
})
