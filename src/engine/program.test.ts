import { describe, expect, it } from 'vitest'
import { ARCHETYPE_BY_ID, archetypeInput } from '../domain/archetypes'
import { DIMENSION_BY_KEY, writeDimension } from '../domain/dimensions'
import type { Score } from '../domain/types'
import { assess } from './assess'
import { analyseProgram, type PortfolioEntry } from './program'

const portfolio = (...ids: string[]): PortfolioEntry[] =>
  ids.map((id) => ({
    id,
    name: ARCHETYPE_BY_ID[id]!.input.definition.name || id,
    input: archetypeInput(id),
  }))

describe('portfolio capability analysis', () => {
  it('returns an empty analysis for an empty portfolio', () => {
    const a = analyseProgram([])
    expect(a.candidates).toEqual([])
    expect(a.sharedConstraints).toEqual([])
    expect(a.unmoved).toEqual([])
  })

  it('only ever proposes capabilities an organisation could fund', () => {
    const a = analyseProgram(portfolio('support-triage', 'payment-exception', 'access-provisioning', 'monitoring'))
    expect(a.candidates.length).toBeGreaterThan(0)
    for (const c of a.candidates) {
      expect(DIMENSION_BY_KEY[c.key].nature).toBe('capability')
    }
  })

  it('ranks by how many workflows an investment unlocks', () => {
    const a = analyseProgram(portfolio('support-triage', 'payment-exception', 'monitoring', 'client-onboarding'))
    const counts = a.candidates.map((c) => c.unlocked.length)
    expect(counts).toEqual(counts.toSorted((x, y) => y - x))
  })

  it('finds the capability that moves more than one workflow at once', () => {
    const a = analyseProgram(portfolio('support-triage', 'monitoring', 'payment-exception'))
    const best = a.candidates[0]!
    expect(best.unlocked.length).toBeGreaterThan(1)
    // And every claimed unlock actually happens when applied.
    for (const u of best.unlocked) {
      const entry = portfolio(u.id)[0]!
      const moved = assess(writeDimension(entry.input, best.key, best.to as Score))
      expect(moved.autonomy.level).toBe(u.to)
      expect(moved.autonomy.level).toBeGreaterThan(u.from)
    }
  })

  it('reports one investment per dimension, not one per target value', () => {
    const a = analyseProgram(portfolio('support-triage', 'monitoring', 'client-onboarding'))
    const keys = a.candidates.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('prefers the cheapest target that achieves the most', () => {
    const a = analyseProgram(portfolio('support-triage', 'monitoring'))
    const verification = a.candidates.find((c) => c.key === 'systems.verification')
    if (verification) {
      // Nothing is gained by demanding 5 where 4 clears the gate.
      expect(verification.to).toBeLessThanOrEqual(4)
    }
  })

  it('counts steps only for workflows that actually need lifting', () => {
    const a = analyseProgram(portfolio('support-triage', 'ops-setup'))
    for (const c of a.candidates) {
      expect(c.totalSteps).toBeGreaterThan(0)
      expect(c.alreadyMet + c.unlocked.length + c.liftedOnly).toBe(2)
    }
  })

  it('names constraints that cap several workflows, without proposing them', () => {
    const a = analyseProgram(portfolio('payment-exception', 'access-provisioning', 'client-onboarding'))
    const regulatory = a.sharedConstraints.find((s) => s.key === 'risk.regulatorySensitivity')
    expect(regulatory).toBeDefined()
    expect(regulatory!.affects.length).toBeGreaterThan(1)
    expect(a.candidates.map((c) => c.key)).not.toContain('risk.regulatorySensitivity')
  })

  it('separates "needs several investments" from "structurally capped"', () => {
    const a = analyseProgram(portfolio('payment-exception', 'document-review', 'compliance-review'))
    const structural = a.unmoved.filter((u) => u.structural)
    const sequencing = a.unmoved.filter((u) => !u.structural)

    expect(structural.length).toBeGreaterThan(0)
    for (const u of structural) expect(u.reason).toMatch(/property of the work|judgment|deterministic|highest level/i)
    for (const u of sequencing) expect(u.reason).toMatch(/investments together|readiness/i)
  })

  it('never lists a workflow as both unlocked and unmoved', () => {
    const a = analyseProgram(portfolio('support-triage', 'payment-exception', 'monitoring', 'document-review'))
    const unlockedIds = new Set(a.candidates.flatMap((c) => c.unlocked.map((u) => u.id)))
    for (const u of a.unmoved) expect(unlockedIds.has(u.id)).toBe(false)
  })

  it('accounts for every workflow exactly once between unlocked and unmoved', () => {
    const ids = ['support-triage', 'payment-exception', 'monitoring', 'document-review', 'compliance-review']
    const a = analyseProgram(portfolio(...ids))
    const unlockedIds = new Set(a.candidates.flatMap((c) => c.unlocked.map((u) => u.id)))
    const unmovedIds = new Set(a.unmoved.map((u) => u.id))
    expect(new Set([...unlockedIds, ...unmovedIds]).size).toBe(ids.length)
  })

  it('handles a single-workflow portfolio', () => {
    const a = analyseProgram(portfolio('support-triage'))
    expect(a.sharedConstraints).toEqual([])
    for (const c of a.candidates) expect(c.unlocked.length).toBeLessThanOrEqual(1)
  })

  it('finds nothing to build when every workflow is already capable', () => {
    // Lift one workflow to the top of every capability dimension.
    let input = archetypeInput('support-triage')
    for (const d of Object.values(DIMENSION_BY_KEY)) {
      if (d.nature !== 'capability') continue
      input = writeDimension(input, d.key, (d.polarity === 'raises' ? 5 : 1) as Score)
    }
    const a = analyseProgram([{ id: 'x', name: 'Already capable', input }])
    expect(a.candidates).toEqual([])
  })

  it('reports capacity gain as well as unlocks, since some lifts only add throughput', () => {
    const a = analyseProgram(portfolio('support-triage', 'client-onboarding', 'monitoring'))
    const throughputOnly = a.candidates.filter((c) => c.unlocked.length === 0)
    for (const c of throughputOnly) expect(c.capacityGain).toBeGreaterThanOrEqual(0.5)
  })
})

describe('constraint attribution is honest', () => {
  it('does not attribute a level-0 recommendation to whichever gates happen to be active', () => {
    // Reconciliation is conventional automation because the work is specified,
    // not because it is regulated. Naming regulation as its cap would be wrong.
    const a = analyseProgram(portfolio('reconciliation', 'payment-exception', 'access-provisioning'))
    const regulatory = a.sharedConstraints.find((s) => s.key === 'risk.regulatorySensitivity')
    expect(regulatory).toBeDefined()
    expect(regulatory!.affects.map((x) => x.id)).not.toContain('reconciliation')
  })

  it('explains a level-0 workflow through the unmoved list instead', () => {
    const a = analyseProgram(portfolio('reconciliation', 'payment-exception'))
    const recon = a.unmoved.find((u) => u.id === 'reconciliation')
    expect(recon).toBeDefined()
    expect(recon!.structural).toBe(true)
    expect(recon!.reason).toMatch(/deterministic automation/i)
  })

  it('never names a constraint as capping a workflow that already meets it', () => {
    const a = analyseProgram(portfolio('support-triage', 'payment-exception', 'monitoring', 'research'))
    for (const sc of a.sharedConstraints) {
      for (const affected of sc.affects) {
        const entry = portfolio(affected.id)[0]!
        const result = assess(entry.input)
        expect(result.autonomy.zeroVariant).toBeNull()
      }
    }
  })
})
