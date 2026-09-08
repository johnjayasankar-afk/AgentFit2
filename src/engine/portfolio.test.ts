import { describe, expect, it } from 'vitest'
import { archetypeInput } from '../domain/archetypes'
import { assess } from './assess'
import { sequence } from './portfolio'

const entry = (id: string, weekly: number | null = 4000) => {
  const base = archetypeInput(id)
  const input = { ...base, economics: { ...base.economics, engineeringWeeklyCost: weekly } }
  return { item: id, result: assess(input) }
}

describe('portfolio sequencing', () => {
  it('puts what can be started now ahead of what is blocked', () => {
    const out = sequence([entry('document-review'), entry('ops-setup')])
    expect(out[0]!.item).toBe('ops-setup')
    expect(out[0]!.stage).toBe('now')
  })

  it('orders startable work by how fast it repays, not by score', () => {
    const out = sequence([entry('payment-exception'), entry('reconciliation'), entry('ops-setup')])
    const now = out.filter((o) => o.stage === 'now')
    const paybacks = now.map((o) => o.result.investment.paybackMonths ?? Infinity)
    expect(paybacks).toEqual(paybacks.toSorted((a, b) => a - b))
  })

  it('ranks a cheap deterministic automation ahead of a more ambitious agent build', () => {
    const out = sequence([entry('payment-exception'), entry('reconciliation')])
    const recon = out.find((o) => o.item === 'reconciliation')!
    const payment = out.find((o) => o.item === 'payment-exception')!
    // Reconciliation is not even an agent — and it still goes first, because it
    // is a fraction of the effort and repays sooner.
    expect(recon.result.autonomy.level).toBe(0)
    expect(payment.result.autonomy.level).toBe(3)
    expect(recon.result.investment.effortWeeks.mid).toBeLessThan(
      payment.result.investment.effortWeeks.mid,
    )
    expect(recon.position).toBeLessThan(payment.position)
  })

  it('sends work whose return does not justify it to the end', () => {
    const out = sequence([entry('scheduling'), entry('ops-setup')])
    expect(out.at(-1)!.item).toBe('scheduling')
    expect(out.at(-1)!.stage).toBe('later')
    expect(out.at(-1)!.reason).toMatch(/upkeep/i)
  })

  it('names the blocker for anything waiting on groundwork', () => {
    const out = sequence([entry('document-review')])
    const blocked = out.find((o) => o.stage === 'next')
    if (blocked) expect(blocked.reason).toMatch(/fund that|groundwork/i)
  })

  it('gives every entry a position, a stage and a reason', () => {
    const out = sequence(
      ['support-triage', 'payment-exception', 'compliance-review', 'reconciliation'].map((id) =>
        entry(id),
      ),
    )
    expect(out.map((o) => o.position)).toEqual([1, 2, 3, 4])
    for (const o of out) expect(o.reason.length).toBeGreaterThan(10)
  })

  it('works with no cost figures at all', () => {
    const out = sequence(['support-triage', 'ops-setup'].map((id) => entry(id, null)))
    expect(out).toHaveLength(2)
    expect(out.every((o) => o.reason.length > 10)).toBe(true)
  })

  it('handles an empty portfolio', () => {
    expect(sequence([])).toEqual([])
  })
})
