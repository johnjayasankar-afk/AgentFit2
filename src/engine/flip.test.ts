import { describe, expect, it } from 'vitest'
import { ARCHETYPES, archetypeInput } from '../domain/archetypes'
import { ALL_DIMENSION_KEYS, DIMENSION_BY_KEY, writeDimension } from '../domain/dimensions'
import type { Score } from '../domain/types'
import { assess } from './assess'
import { findFlipPoints } from './flip'

describe('flip points', () => {
  it('reports a boundary that actually changes the recommendation when applied', () => {
    for (const a of ARCHETYPES) {
      const input = archetypeInput(a.id)
      const base = assess(input).autonomy.displayName
      for (const p of findFlipPoints(input).points) {
        const moved = assess(writeDimension(input, p.key, p.to as Score))
        expect(moved.autonomy.displayName).not.toBe(base)
        expect(moved.autonomy.displayName).toBe(p.becomes)
      }
    }
  })

  it('reports the nearest crossing, not the furthest', () => {
    for (const a of ARCHETYPES) {
      const input = archetypeInput(a.id)
      const base = assess(input).autonomy.displayName
      for (const p of findFlipPoints(input).points) {
        // Nothing strictly between the current value and the reported one may
        // already have changed the answer.
        const direction = Math.sign(p.to - p.from)
        for (let step = 1; step < p.distance; step += 1) {
          const between = (p.from + direction * step) as Score
          expect(assess(writeDimension(input, p.key, between)).autonomy.displayName).toBe(base)
        }
      }
    }
  })

  it('names each dimension at most once', () => {
    for (const a of ARCHETYPES) {
      const keys = findFlipPoints(archetypeInput(a.id)).points.map((p) => p.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('orders by distance, nearest first', () => {
    for (const a of ARCHETYPES) {
      const d = findFlipPoints(archetypeInput(a.id)).points.map((p) => p.distance)
      expect(d).toEqual(d.toSorted((x, y) => x - y))
    }
  })

  it('finds what would make a deterministic workflow need a model', () => {
    const f = findFlipPoints(archetypeInput('reconciliation'))
    expect(assess(archetypeInput('reconciliation')).autonomy.zeroVariant).toBe('conventional')
    const keys = f.points.map((p) => p.key)
    // The things that make rules sufficient are exactly what would stop them being so.
    expect(keys).toContain('structure.exceptionRate')
    expect(keys).toContain('structure.ruleClarity')
    expect(f.stable).toBe(false)
  })

  it('finds what would let work leave a person’s hands', () => {
    const f = findFlipPoints(archetypeInput('compliance-review'))
    expect(assess(archetypeInput('compliance-review')).autonomy.zeroVariant).toBe('human-led')
    expect(f.points.map((p) => p.key)).toContain('systems.verification')
  })

  it('carries the capability or constraint nature of each boundary', () => {
    for (const a of ARCHETYPES) {
      for (const p of findFlipPoints(archetypeInput(a.id)).points) {
        expect(p.nature).toBe(DIMENSION_BY_KEY[p.key].nature)
      }
    }
  })

  it('reports stability honestly when nothing moves the answer', () => {
    // Pin every dimension to its most extreme unfavourable value: nothing can
    // then move the recommendation off the bottom of the ladder in one step.
    let input = archetypeInput('custom')
    for (const key of ALL_DIMENSION_KEYS) {
      const meta = DIMENSION_BY_KEY[key]
      input = writeDimension(input, key, (meta.polarity === 'raises' ? 1 : 5) as Score)
    }
    const f = findFlipPoints(input)
    if (f.stable) {
      expect(f.points).toEqual([])
      expect(f.nearest).toBeNull()
      expect(f.summary).toMatch(/nothing within any single scale/i)
    }
  })

  it('summarises every archetype in a usable sentence', () => {
    for (const a of ARCHETYPES) {
      const f = findFlipPoints(archetypeInput(a.id))
      expect(f.summary.length).toBeGreaterThan(40)
      if (!f.stable) expect(f.nearest).toBeGreaterThan(0)
    }
  })
})
