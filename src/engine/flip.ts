import type { AssessmentInput, DimensionKey, Score } from '../domain/types'
import { ALL_DIMENSION_KEYS, DIMENSION_BY_KEY, readDimension, writeDimension } from '../domain/dimensions'
import { assess } from './assess'

/**
 * Where the answer changes.
 *
 * "Path to greater autonomy" assumes the reader wants more autonomy, which is
 * the wrong question for a workflow the model has just told them not to
 * agentify. For those, the useful question is the inverse: what would have to
 * become true before deterministic automation stopped being enough, or before
 * the work could leave a person's hands?
 *
 * Both are the same computation — walk each dimension away from where it sits
 * and find the first value at which the recommendation is no longer the same
 * one. Reported as a boundary rather than as advice: crossing it is usually
 * something that happens to a workflow, not something anyone does on purpose.
 */

export interface FlipPoint {
  key: DimensionKey
  label: string
  from: Score
  /** The first value at which the recommendation changes. */
  to: Score
  /** Distance in ordinal steps — how close this workflow sits to the edge. */
  distance: number
  /** What the recommendation becomes there. */
  becomes: string
  /** Whether the change is a property of the work or of what has been built. */
  nature: 'capability' | 'constraint'
}

export interface FlipAnalysis {
  /** Nearest boundaries first. */
  points: FlipPoint[]
  /** True when nothing within any scale changes the recommendation. */
  stable: boolean
  /** The smallest number of steps to any boundary, or null when stable. */
  nearest: number | null
  summary: string
}

/**
 * Every single-dimension move that changes the recommendation, nearest first.
 *
 * Only the *first* crossing per dimension is reported: once the answer has
 * changed, further movement in the same direction is a different question.
 */
export function findFlipPoints(input: AssessmentInput): FlipAnalysis {
  const base = assess(input)
  const baseName = base.autonomy.displayName
  const points: FlipPoint[] = []

  for (const key of ALL_DIMENSION_KEYS) {
    const current = readDimension(input, key)
    const meta = DIMENSION_BY_KEY[key]

    // Walk outward in both directions, taking whichever edge is nearer.
    let nearest: FlipPoint | null = null
    for (const direction of [-1, 1] as const) {
      for (let step = 1; step <= 4; step += 1) {
        const target = current + direction * step
        if (target < 1 || target > 5) break
        const moved = assess(writeDimension(input, key, target as Score))
        if (moved.autonomy.displayName === baseName) continue
        if (nearest === null || step < nearest.distance) {
          nearest = {
            key,
            label: meta.label,
            from: current,
            to: target as Score,
            distance: step,
            becomes: moved.autonomy.displayName,
            nature: meta.nature,
          }
        }
        break
      }
    }
    if (nearest) points.push(nearest)
  }

  const sorted = points.toSorted((a, b) => a.distance - b.distance || a.label.localeCompare(b.label))
  const nearestDistance = sorted[0]?.distance ?? null

  return {
    points: sorted,
    stable: sorted.length === 0,
    nearest: nearestDistance,
    summary: summarise(baseName, sorted, nearestDistance),
  }
}

function summarise(baseName: string, points: FlipPoint[], nearest: number | null): string {
  if (points.length === 0) {
    return `Nothing within any single scale changes this recommendation. ${baseName} holds across the whole range of every dimension taken one at a time.`
  }

  const atEdge = points.filter((p) => p.distance === nearest)
  const names = atEdge.slice(0, 3).map((p) => p.label.toLowerCase())
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`

  if (nearest === 1) {
    return `This sits one step from a different answer. A single move in ${list} changes it, so the recommendation is worth re-checking whenever the workflow does.`
  }
  return `The nearest boundary is ${nearest} steps away, in ${list}. Below that, ${baseName.toLowerCase()} holds.`
}
