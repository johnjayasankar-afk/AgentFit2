import type { AssessmentInput, DimensionKey, Score } from '../domain/types'
import { ALL_DIMENSION_KEYS, DIMENSION_BY_KEY, readDimension, writeDimension } from '../domain/dimensions'
import { assess } from './assess'
import { unmetRequirements, type AutonomyLevel } from './autonomy'

export interface SensitivityEntry {
  key: DimensionKey
  label: string
  /** Whether an organisation can decide to change this at all. */
  nature: 'capability' | 'constraint'
  /** Current value of the dimension. */
  current: Score
  /** Change in fit score from a single step in the improving direction. */
  fitUpside: number
  /** Change in net weekly capacity hours from a single step. */
  capacityUpside: number
  /**
   * The cheapest improvement that raises the autonomy level, if one exists
   * within the scale. Reported with the number of steps it costs, because a
   * two-step move that clears a gate usually beats a one-step move that does
   * not.
   */
  unlock: { level: AutonomyLevel; steps: number; to: Score } | null
  /**
   * The lowest autonomy cap this dimension is currently helping to hold down,
   * if it appears in an unmet requirement of an active gate. A dimension can
   * block a level without unlocking it on its own, when a second gate caps at
   * the same level — which is the common case and the reason a purely
   * one-at-a-time analysis understates the things that matter most.
   */
  blocksLevel: AutonomyLevel | null
  /** True when the dimension is already at its most favourable value. */
  atCeiling: boolean
  /**
   * Ordering weight for improvements: value per step of effort. Only upside
   * counts — a move that lowers the score is not leverage.
   */
  leverage: number
  /**
   * Absolute influence on the model, regardless of direction. Used to rank
   * constraints, where the question is what is load-bearing rather than what
   * would help.
   */
  influence: number
}

/**
 * The complete set of moves that raises the autonomy level, when no single
 * dimension can do it alone. Derived from the gates rather than searched, so it
 * is exact and costs one extra evaluation.
 */
export interface CombinedUnlock {
  /** Investable moves required, in the order the gates report them. */
  moves: { key: DimensionKey; label: string; from: Score; to: number }[]
  /**
   * Requirements the gates name that nobody can fund — the work being less
   * consequential, less regulated, or needing less judgment. Present means the
   * ceiling is structural rather than a matter of investment.
   */
  blockedBy: { key: DimensionKey; label: string; from: Score; to: number }[]
  /** Total ordinal steps across all moves — a rough proxy for effort. */
  steps: number
  /** The level reached when every investable move is applied. */
  level: AutonomyLevel
  /** False when constraints hold the level down regardless of investment. */
  reachable: boolean
}

export interface SensitivityResult {
  entries: SensitivityEntry[]
  /** Highest-leverage moves an organisation could actually fund. */
  highest: SensitivityEntry[]
  /** Investable dimensions that would barely move the outcome. */
  lowest: SensitivityEntry[]
  /**
   * Constraint dimensions that are load-bearing here — they dominate the
   * outcome but are not things anyone can decide to change. Reported so the
   * ceiling is explicable, never as a suggestion.
   */
  constraints: SensitivityEntry[]
  /** Null when a single dimension already unlocks, or nothing does. */
  combined: CombinedUnlock | null
}

/**
 * Deterministic perturbation analysis.
 *
 * Every dimension is walked through each remaining step in the direction that
 * improves autonomy readiness, and the whole model is recomputed at each stop.
 * Two things are recorded: the immediate score effect of one step, and the
 * cheapest move anywhere on the scale that actually raises the autonomy level.
 *
 * Leverage weights the second far more heavily than the first, discounted by
 * the number of steps it costs — clearing a gate is categorically more valuable
 * than accumulating points, which is the same claim the recommendation engine
 * makes. Without the multi-step walk, a dimension two steps away from clearing
 * a gate would look inert.
 */
export function computeSensitivity(input: AssessmentInput): SensitivityResult {
  const base = assess(input)

  // Which dimensions stand between this workflow and the next rung. Scoped to
  // exactly the gates `pathToLevel` reports — gates capping below the target —
  // so sensitivity and the path view can never name different blockers.
  const nextRung = base.autonomy.level + 1
  const blocking = new Map<DimensionKey, AutonomyLevel>()
  for (const gate of base.autonomy.activeGates) {
    if (gate.cap >= nextRung) continue
    for (const r of unmetRequirements(input, gate)) {
      const current = blocking.get(r.key)
      if (current === undefined || gate.cap < current) blocking.set(r.key, gate.cap)
    }
  }

  const entries: SensitivityEntry[] = ALL_DIMENSION_KEYS.map((key) => {
    const meta = DIMENSION_BY_KEY[key]
    const current = readDimension(input, key)
    const improveUp = meta.polarity === 'raises'
    const targets: Score[] = []
    if (improveUp) {
      for (let v = current + 1; v <= 5; v += 1) targets.push(v as Score)
    } else {
      for (let v = current - 1; v >= 1; v -= 1) targets.push(v as Score)
    }

    const blocksLevel = blocking.get(key) ?? null

    if (targets.length === 0) {
      return {
        key, label: meta.label, nature: meta.nature, current,
        fitUpside: 0, capacityUpside: 0, unlock: null, blocksLevel,
        atCeiling: true, leverage: 0, influence: 0,
      }
    }

    let fitUpside = 0
    let capacityUpside = 0
    let unlock: SensitivityEntry['unlock'] = null

    targets.forEach((target, index) => {
      const moved = assess(writeDimension(input, key, target))
      if (index === 0) {
        fitUpside = moved.fit.score - base.fit.score
        capacityUpside = moved.capacity.netCapacityHours - base.capacity.netCapacityHours
      }
      if (!unlock && moved.autonomy.level > base.autonomy.level) {
        unlock = { level: moved.autonomy.level, steps: index + 1, to: target }
      }
    })

    const resolved = unlock as NonNullable<SensitivityEntry['unlock']> | null
    const unlockValue = resolved
      ? (40 * (resolved.level - base.autonomy.level)) / resolved.steps
      : 0

    // Participating in a binding gate is worth almost as much as clearing one
    // outright: the workflow cannot advance until this dimension moves, even
    // though moving it alone changes nothing while a second gate holds.
    const blockingValue = blocksLevel !== null && !resolved ? 30 : 0

    return {
      key,
      label: meta.label,
      nature: meta.nature,
      current,
      fitUpside,
      capacityUpside,
      unlock,
      blocksLevel,
      atCeiling: false,
      // Only upside counts toward leverage. Some capability improvements lower
      // the score — better-structured inputs make a model less necessary, which
      // is real and correct — and ranking those as the best thing to do next
      // would be nonsense.
      leverage:
        Math.max(0, fitUpside) + unlockValue + blockingValue + Math.max(0, capacityUpside) / 2,
      influence:
        Math.abs(fitUpside) + unlockValue + blockingValue + Math.min(10, Math.abs(capacityUpside) / 2),
    }
  })

  const ranked = entries.toSorted((a, b) => b.influence - a.influence)
  const movable = ranked.filter((e) => !e.atCeiling)

  // Only capability dimensions can be ranked as improvements. A tool that
  // suggests reducing regulatory sensitivity or the judgment a decision needs
  // is not giving advice, and every such suggestion costs it credibility.
  const investable = movable
    .filter((e) => e.nature === 'capability' && e.leverage > 0)
    .toSorted((a, b) => b.leverage - a.leverage)
  const constraints = movable.filter(
    (e) => e.nature === 'constraint' && (e.unlock !== null || e.blocksLevel !== null || Math.abs(e.fitUpside) >= 3),
  )

  // The two lists must not overlap. With fewer than seven investable
  // dimensions, slicing four from the front and three from the back returns the
  // same dimension in both — which reads as a rendering bug and undermines the
  // ranking it is meant to explain.
  const highest = investable.slice(0, 4)
  const lowest = investable
    .slice(highest.length)
    .slice(-3)
    .toReversed()

  return {
    entries: ranked,
    highest,
    lowest,
    constraints: constraints.slice(0, 4),
    combined: combinedUnlock(input, base, entries),
  }
}

/**
 * When gates cap at the same level, clearing one changes nothing — so the
 * one-at-a-time view correctly reports no unlock, and correctly leaves the user
 * without an answer. This supplies it: apply every requirement the path names
 * and report what the combination actually reaches.
 */
function combinedUnlock(
  input: AssessmentInput,
  base: ReturnType<typeof assess>,
  entries: SensitivityEntry[],
): CombinedUnlock | null {
  // A single dimension already does the job; no combination needed.
  if (entries.some((e) => e.unlock !== null)) return null
  if (base.path.steps.length === 0) return null

  let moved = input
  const moves: CombinedUnlock['moves'] = []
  const blockedBy: CombinedUnlock['blockedBy'] = []

  for (const step of base.path.steps) {
    for (const r of step.requirements) {
      if (moves.some((m) => m.key === r.key) || blockedBy.some((b) => b.key === r.key)) continue
      if (DIMENSION_BY_KEY[r.key].nature === 'constraint') {
        // A path that depends on the work being less consequential is not a
        // path. Naming it is still useful: it says the ceiling is structural.
        blockedBy.push({ key: r.key, label: r.label, from: r.from, to: r.to })
        continue
      }
      moves.push({ key: r.key, label: r.label, from: r.from, to: r.to })
      moved = writeDimension(moved, r.key, r.to as Score)
    }
  }
  if (moves.length === 0) return null

  const result = assess(moved)
  // Constraints elsewhere may hold the level down even after every investable
  // move lands. That is a finding, not a failure — report it as reachable=false.
  return {
    moves,
    blockedBy,
    steps: moves.reduce((sum, m) => sum + Math.abs(m.to - m.from), 0),
    level: result.autonomy.level,
    reachable: result.autonomy.level > base.autonomy.level,
  }
}
