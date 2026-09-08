import { describe, expect, it } from 'vitest'
import { activeSection, anchorFor, STRIP_OFFSET } from './GroupJump'

/** Heading positions as they would be at a given scroll depth. */
const at = (...tops: number[]) =>
  ['group-define', 'group-economics', 'group-structure', 'group-systems', 'group-risk', 'group-oversight', 'group-notes']
    .map((id, i) => ({ id, top: tops[i] ?? 9999 }))

describe('active assessment section', () => {
  it('starts on the first section before anything has scrolled past', () => {
    expect(activeSection(at(200, 600, 1100, 1900, 2600, 3400, 4000))).toBe('define')
  })

  it('follows the last heading to pass under the strip', () => {
    // Scrolled so that risk has just gone under and oversight has not.
    expect(activeSection(at(-2470, -2079, -1543, -787, -30, 726, 1351))).toBe('risk')
  })

  it('switches exactly at the strip, not before', () => {
    expect(activeSection(at(-100, STRIP_OFFSET + 1))).toBe('define')
    expect(activeSection(at(-100, STRIP_OFFSET))).toBe('economics')
  })

  it('lands on the last section at the bottom of the page', () => {
    expect(activeSection(at(-4000, -3600, -3100, -2300, -1500, -800, -120))).toBe('notes')
  })

  it('ignores headings it does not know about', () => {
    expect(activeSection([{ id: 'group-define', top: -10 }, { id: 'something-else', top: -5 }])).toBe('define')
  })

  it('handles an empty list', () => {
    expect(activeSection([])).toBe('define')
  })

  it('maps every section to a real anchor id', () => {
    expect(anchorFor('define')).toBe('group-define')
    expect(anchorFor('notes')).toBe('group-notes')
    expect(anchorFor('systems')).toBe('group-systems')
  })
})
