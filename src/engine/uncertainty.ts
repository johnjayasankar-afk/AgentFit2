import type { Assessment, DimensionKey, Score } from '../domain/types'
import { ALL_DIMENSION_KEYS, DIMENSION_BY_KEY, readDimension, writeDimension } from '../domain/dimensions'
import { assess } from './assess'
import { AUTONOMY_BY_LEVEL, type AutonomyLevel } from './autonomy'

export interface UncertaintyContributor {
  key: DimensionKey
  label: string
  /** Largest fit movement from a one-step correction in either direction. */
  swing: number
  /** Autonomy levels reachable within a one-step correction, if more than one. */
  levels: AutonomyLevel[]
}

export interface Uncertainty {
  /** ± on the fit score, in points. */
  band: number
  low: number
  high: number
  unreviewedCount: number
  /** Unreviewed dimensions whose plausible range would change the recommendation. */
  volatile: UncertaintyContributor[]
  /** Ranked by how much each unreviewed dimension widens the band. */
  contributors: UncertaintyContributor[]
  /** True when no unreviewed dimension can change the autonomy recommendation. */
  recommendationStable: boolean
  summary: string
}

/**
 * How much the score could move once the unreviewed dimensions are actually
 * reviewed.
 *
 * A preset is a defensible median, not a measurement, so every dimension the
 * user has not touched carries about a step of plausible error in either
 * direction. Each unreviewed dimension is moved one step both ways, the larger
 * fit swing is kept, and the swings are combined in quadrature rather than
 * summed — they are independent judgements, and summing them would produce a
 * band so wide it would say nothing.
 *
 * The more useful output is the second one: whether any single unreviewed
 * dimension could change the *recommendation*. A score that moves by four
 * points is noise. A recommendation that flips between supervised and bounded
 * depending on a value nobody has looked at is a reason to go and look.
 */
export function computeUncertainty(assessment: Assessment): Uncertainty {
  const input = assessment.input
  const base = assess(input)
  const touched = new Set(assessment.touched)
  const unreviewed = ALL_DIMENSION_KEYS.filter((k) => !touched.has(k))

  const contributors: UncertaintyContributor[] = []

  for (const key of unreviewed) {
    const current = readDimension(input, key)
    const levels = new Set<AutonomyLevel>([base.autonomy.level])
    let swing = 0

    for (const delta of [-1, 1]) {
      const target = current + delta
      if (target < 1 || target > 5) continue
      const moved = assess(writeDimension(input, key, target as Score))
      swing = Math.max(swing, Math.abs(moved.fit.score - base.fit.score))
      levels.add(moved.autonomy.level)
    }

    contributors.push({
      key,
      label: DIMENSION_BY_KEY[key].label,
      swing,
      levels: [...levels].toSorted((a, b) => a - b),
    })
  }

  const band = Math.round(Math.sqrt(contributors.reduce((sum, c) => sum + c.swing * c.swing, 0)))
  const volatile = contributors
    .filter((c) => c.levels.length > 1)
    .toSorted((a, b) => b.levels.length - a.levels.length || b.swing - a.swing)

  const ranked = contributors.toSorted((a, b) => b.swing - a.swing).filter((c) => c.swing > 0)

  return {
    band,
    low: Math.max(0, base.fit.score - band),
    high: Math.min(100, base.fit.score + band),
    unreviewedCount: unreviewed.length,
    volatile,
    contributors: ranked,
    recommendationStable: volatile.length === 0,
    summary: summarise(band, unreviewed.length, volatile),
  }
}

function summarise(band: number, unreviewed: number, volatile: UncertaintyContributor[]): string {
  if (unreviewed === 0) {
    return 'Every dimension has been reviewed. The score carries no preset assumptions.'
  }

  const opening = `${unreviewed} dimension${unreviewed === 1 ? '' : 's'} still hold${unreviewed === 1 ? 's' : ''} its preset value, which puts the score within about ${band} point${band === 1 ? '' : 's'} either way.`

  if (volatile.length === 0) {
    return `${opening} None of them can change the autonomy recommendation, so the conclusion holds even if the presets are wrong.`
  }

  const names = volatile.slice(0, 3).map((v) => v.label.toLowerCase())
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

  const reachable = [...new Set(volatile.flatMap((v) => v.levels))].toSorted((a, b) => a - b)
  const span = `${AUTONOMY_BY_LEVEL[reachable[0]!].short.toLowerCase()} to ${AUTONOMY_BY_LEVEL[reachable[reachable.length - 1]!].short.toLowerCase()}`

  return `${opening} The recommendation is not settled: reviewing ${list} could move it, and the range currently reachable runs from ${span}.`
}
