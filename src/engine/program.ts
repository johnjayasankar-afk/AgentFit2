import type { AssessmentInput, DimensionKey, Score } from '../domain/types'
import { DIMENSION_BY_KEY, DIMENSIONS, readDimension, writeDimension } from '../domain/dimensions'
import { assess } from './assess'
import type { AutonomyLevel } from './autonomy'

/**
 * Portfolio-level capability analysis.
 *
 * A single assessment answers "what would have to change for *this* workflow".
 * Across a portfolio the more valuable question is the inverse: which one
 * capability, built once, moves the most workflows at once. Verification
 * infrastructure that unlocks four workflows is a different kind of investment
 * from a bespoke integration that unlocks one, and nothing in a per-workflow
 * view can tell them apart.
 *
 * Only capability dimensions are considered. An organisation cannot fund a
 * programme to make its decisions less regulated.
 */

export interface UnlockedWorkflow {
  id: string
  name: string
  from: AutonomyLevel
  to: AutonomyLevel
  /** Ordinal steps this workflow needs to reach the target. */
  steps: number
}

export interface UnlockCandidate {
  key: DimensionKey
  label: string
  /** The level every workflow in the portfolio would be brought to. */
  to: Score
  /** Workflows that gain at least one autonomy level from this alone. */
  unlocked: UnlockedWorkflow[]
  /** Workflows that would be lifted but do not gain a level from it alone. */
  liftedOnly: number
  /** Workflows already at or beyond the target — no work needed. */
  alreadyMet: number
  /** Net weekly capacity gained across the whole portfolio. */
  capacityGain: number
  /** Ordinal steps summed across every workflow that needs lifting. */
  totalSteps: number
  /** Capacity gained per step of lift — how efficient the investment is. */
  efficiency: number
}

export interface ProgramAnalysis {
  /** Ranked capability investments, best first. */
  candidates: UnlockCandidate[]
  /** Constraints that cap more than one workflow and cannot be invested in. */
  sharedConstraints: {
    key: DimensionKey
    label: string
    /** Workflows whose autonomy this constraint currently holds down. */
    affects: { id: string; name: string }[]
  }[]
  /**
   * Workflows no *single* capability investment moves. Split by why: some need
   * several investments at once, others are held by something structural that
   * no amount of building will change.
   */
  unmoved: { id: string; name: string; reason: string; structural: boolean }[]
}

export interface PortfolioEntry {
  id: string
  name: string
  input: AssessmentInput
}

/** Values worth testing for a dimension, in the improving direction. */
function targetsFor(key: DimensionKey): Score[] {
  const raises = DIMENSION_BY_KEY[key].polarity === 'raises'
  const out: Score[] = []
  if (raises) for (let v = 2; v <= 5; v += 1) out.push(v as Score)
  else for (let v = 4; v >= 1; v -= 1) out.push(v as Score)
  return out
}

/** Does `value` already satisfy `target` for this dimension's direction? */
function meets(key: DimensionKey, value: Score, target: Score): boolean {
  return DIMENSION_BY_KEY[key].polarity === 'raises' ? value >= target : value <= target
}

export function analyseProgram(entries: PortfolioEntry[]): ProgramAnalysis {
  if (entries.length === 0) {
    return { candidates: [], sharedConstraints: [], unmoved: [] }
  }

  const baseline = entries.map((e) => ({ entry: e, result: assess(e.input) }))
  const capabilities = DIMENSIONS.filter((d) => d.nature === 'capability')
  const candidates: UnlockCandidate[] = []

  for (const dimension of capabilities) {
    for (const target of targetsFor(dimension.key)) {
      const unlocked: UnlockedWorkflow[] = []
      let alreadyMet = 0
      let liftedOnly = 0
      let capacityGain = 0
      let totalSteps = 0

      for (const { entry, result } of baseline) {
        const current = readDimension(entry.input, dimension.key)
        if (meets(dimension.key, current, target)) {
          alreadyMet += 1
          continue
        }

        const steps = Math.abs(target - current)
        totalSteps += steps

        const moved = assess(writeDimension(entry.input, dimension.key, target))
        const gain = moved.capacity.netCapacityHours - result.capacity.netCapacityHours
        capacityGain += gain

        if (moved.autonomy.level > result.autonomy.level) {
          unlocked.push({
            id: entry.id,
            name: entry.name,
            from: result.autonomy.level,
            to: moved.autonomy.level,
            steps,
          })
        } else {
          liftedOnly += 1
        }
      }

      // A candidate nobody needs, or that changes nothing, is not a candidate.
      if (totalSteps === 0) continue
      if (unlocked.length === 0 && capacityGain < 0.5) continue

      candidates.push({
        key: dimension.key,
        label: dimension.label,
        to: target,
        unlocked,
        liftedOnly,
        alreadyMet,
        capacityGain,
        totalSteps,
        efficiency: capacityGain / totalSteps,
      })
    }
  }

  // Keep the cheapest target per dimension that unlocks the most. Reporting
  // "verification to 4" and "verification to 5" as separate investments would
  // double-count one programme of work.
  const bestPerDimension = new Map<DimensionKey, UnlockCandidate>()
  for (const c of candidates) {
    const held = bestPerDimension.get(c.key)
    if (
      !held ||
      c.unlocked.length > held.unlocked.length ||
      (c.unlocked.length === held.unlocked.length && c.totalSteps < held.totalSteps)
    ) {
      bestPerDimension.set(c.key, c)
    }
  }

  const ranked = [...bestPerDimension.values()].toSorted(
    (a, b) =>
      b.unlocked.length - a.unlocked.length ||
      b.capacityGain - a.capacityGain ||
      a.totalSteps - b.totalSteps,
  )

  return {
    candidates: ranked,
    sharedConstraints: sharedConstraints(baseline),
    unmoved: unmoved(baseline, ranked),
  }
}

/**
 * Constraints holding down more than one workflow. These are not investments;
 * they are the shape of the portfolio, and knowing which recur tells a team
 * where its autonomy ceiling genuinely sits.
 */
function sharedConstraints(
  baseline: { entry: PortfolioEntry; result: ReturnType<typeof assess> }[],
): ProgramAnalysis['sharedConstraints'] {
  const map = new Map<DimensionKey, { id: string; name: string }[]>()

  for (const { entry, result } of baseline) {
    // A level-0 recommendation is not gate-capped: it comes from the work being
    // deterministic enough to need no model, or from the judgment being the
    // deliverable. Attributing it to whichever gates happen to be active would
    // name a constraint that is not doing the work.
    if (result.autonomy.zeroVariant !== null) continue

    const seen = new Set<DimensionKey>()
    for (const gate of result.autonomy.bindingGates) {
      for (const r of gate.requirements) {
        if (DIMENSION_BY_KEY[r.key].nature !== 'constraint') continue
        if (seen.has(r.key)) continue
        const value = readDimension(entry.input, r.key)
        const met = r.op === '>=' ? value >= r.value : value <= r.value
        if (met) continue
        seen.add(r.key)
        const list = map.get(r.key) ?? []
        list.push({ id: entry.id, name: entry.name })
        map.set(r.key, list)
      }
    }
  }

  return [...map.entries()]
    .filter(([, affects]) => affects.length > 1)
    .map(([key, affects]) => ({ key, label: DIMENSION_BY_KEY[key].label, affects }))
    .toSorted((a, b) => b.affects.length - a.affects.length)
}

/**
 * Workflows no single investment in this analysis moves.
 *
 * The distinction that matters is *why*. A workflow needing three capabilities
 * at once is a sequencing problem; a workflow held by a regulator is not a
 * problem at all, it is the answer. Conflating them would send a team to build
 * something that changes nothing.
 */
function unmoved(
  baseline: { entry: PortfolioEntry; result: ReturnType<typeof assess> }[],
  candidates: UnlockCandidate[],
): ProgramAnalysis['unmoved'] {
  const movable = new Set(candidates.flatMap((c) => c.unlocked.map((u) => u.id)))

  return baseline
    .filter(({ entry }) => !movable.has(entry.id))
    .map(({ entry, result }) => {
      if (result.autonomy.zeroVariant === 'human-led') {
        return { id: entry.id, name: entry.name, structural: true,
          reason: 'The judgment is the deliverable. No capability changes that.' }
      }
      if (result.autonomy.zeroVariant === 'conventional') {
        return { id: entry.id, name: entry.name, structural: true,
          reason: 'Already best served by deterministic automation.' }
      }
      if (result.autonomy.level >= 5) {
        return { id: entry.id, name: entry.name, structural: true,
          reason: 'Already at the highest level this model will recommend.' }
      }

      // Which unmet requirements are investable, and which are not?
      const investable: string[] = []
      const structural: string[] = []
      const seen = new Set<DimensionKey>()
      for (const gate of result.autonomy.bindingGates) {
        for (const r of gate.requirements) {
          if (seen.has(r.key)) continue
          const value = readDimension(entry.input, r.key)
          const met = r.op === '>=' ? value >= r.value : value <= r.value
          if (met) continue
          seen.add(r.key)
          const meta = DIMENSION_BY_KEY[r.key]
          ;(meta.nature === 'capability' ? investable : structural).push(meta.label.toLowerCase())
        }
      }

      if (investable.length > 1) {
        return {
          id: entry.id, name: entry.name, structural: false,
          reason: `Needs ${investable.length} investments together — ${investable.join(', ')} — so no single programme moves it.`,
        }
      }
      if (structural.length > 0) {
        return {
          id: entry.id, name: entry.name, structural: true,
          reason: `Held by ${structural.join(' and ')}, which is a property of the work rather than something to build.`,
        }
      }
      return {
        id: entry.id, name: entry.name, structural: false,
        reason: `Held at ${result.autonomy.displayShort.toLowerCase()} by its overall readiness rather than one gate.`,
      }
    })
}
