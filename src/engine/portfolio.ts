import type { AssessmentResult } from './assess'

export interface SequenceItem<T> {
  item: T
  result: AssessmentResult
  /** 1-based position in the recommended order. */
  position: number
  /** Why it sits here, in one line. */
  reason: string
  /** Actionable now, or waiting on something. */
  stage: 'now' | 'next' | 'later'
}

/**
 * A recommended order of work across a portfolio.
 *
 * Sequencing is not the same question as classification. Classification asks
 * what kind of thing each workflow is; sequencing asks which one a team should
 * pick up on Monday. The two can disagree — a cheap deterministic automation
 * that repays in three months belongs ahead of a more impressive agent that
 * repays in eighteen, even though only the second is a "build now".
 *
 * The order is: what can be started now, cheapest payback first; then what is
 * blocked on groundwork, least groundwork first; then everything whose return
 * does not currently justify the work.
 */
export function sequence<T>(entries: { item: T; result: AssessmentResult }[]): SequenceItem<T>[] {
  const scored = entries.map((entry) => {
    const { result } = entry
    const ready =
      result.readiness.level === 'pilot' || result.readiness.level === 'production-candidate'
    const returns = result.investment.verdict
    const worthIt = returns !== 'unfavourable' && returns !== 'no-build'

    const stage: SequenceItem<T>['stage'] =
      returns === 'unfavourable' ? 'later' : ready && worthIt ? 'now' : returns === 'no-build' ? 'later' : 'next'

    // Cheapest first within a stage. Payback where money is known, effort where
    // it is not — both are "how long until this is done paying for itself".
    const cost =
      result.investment.paybackMonths ??
      (result.investment.returnRatio !== null
        ? 240 / Math.max(1, result.investment.returnRatio)
        : result.investment.effortWeeks.mid || 999)

    return { entry, stage, cost, ready, worthIt }
  })

  const rank: Record<SequenceItem<T>['stage'], number> = { now: 0, next: 1, later: 2 }

  return scored
    .toSorted((a, b) => rank[a.stage] - rank[b.stage] || a.cost - b.cost)
    .map((s, i) => ({
      item: s.entry.item,
      result: s.entry.result,
      position: i + 1,
      stage: s.stage,
      reason: reasonFor(s.entry.result, s.stage),
    }))
}

function reasonFor(r: AssessmentResult, stage: SequenceItem<unknown>['stage']): string {
  const inv = r.investment

  if (stage === 'now') {
    const cost =
      inv.paybackMonths !== null
        ? `repays in about ${Math.round(inv.paybackMonths)} months`
        : `about ${inv.effortWeeks.low}–${inv.effortWeeks.high} engineer-weeks`
    return `Ready to start, ${cost}.`
  }

  if (stage === 'next') {
    const blocker = r.readiness.blockers[0]?.label ?? r.autonomy.bindingGates[0]?.title
    return blocker
      ? `Blocked on ${blocker.toLowerCase()} — fund that, not the agent.`
      : 'Waiting on groundwork before the build is worth starting.'
  }

  if (inv.verdict === 'no-build') {
    return r.autonomy.zeroVariant === 'human-led'
      ? 'No system to build — the judgment is the deliverable.'
      : 'No implementation implied at this level.'
  }

  return inv.repaysFromCapacity
    ? 'The return does not justify the effort against the others here.'
    : 'Upkeep alone outruns the capacity returned.'
}

export const STAGE_LABEL: Record<SequenceItem<unknown>['stage'], string> = {
  now: 'Start now',
  next: 'Fund the groundwork',
  later: 'Not on capacity grounds',
}
