import { describe, expect, it } from 'vitest'
import { decodeShare, encodeShare, shareSummary } from './link'
import { createAssessment } from './db'
import { archetypeInput } from '../domain/archetypes'
import { writeDimension } from '../domain/dimensions'
import type { Assessment } from '../domain/types'

const BASE = archetypeInput('custom')

/** A worked assessment: every kind of slot carries something. */
function worked(): Assessment {
  const a = createAssessment('support-triage')
  let input = a.input
  input = writeDimension(input, 'risk.reversibility', 2)
  input = writeDimension(input, 'systems.verification', 5)
  input = writeDimension(input, 'oversight.reviewCost', 1)
  return {
    ...a,
    input: {
      ...input,
      definition: {
        name: 'Payment exception investigation',
        description: 'Reconcile failed payments against the ledger and escalate what will not clear.',
        archetype: 'payment-exception',
      },
      economics: {
        ...input.economics,
        volume: 420,
        period: 'day',
        minutesPerCase: 35,
        peopleInvolved: 2,
        loadedHourlyCost: 85,
        engineeringWeeklyCost: 9000,
      },
      assumptions: {
        coveragePct: 65,
        timeReductionPct: 70,
        reviewRatePct: 30,
        reviewMinutes: 4,
        exceptionMinutes: 20,
      },
    },
    notes: 'Payments team wants ledger writes behind approval for the first month.',
    decision: {
      status: 'proceeding',
      chosenLevel: 3,
      owner: 'Controller',
      decidedAt: 1_757_260_800_000,
      rationale: 'Review cost is low enough that a human queue is affordable at this volume.',
      revisit: 'After the pilot, or if volume doubles.',
    },
    touched: ['risk.reversibility', 'systems.verification', 'economics.volume'],
    riskEdits: { 'irreversible-action': { mitigation: 'Approval queue for month one.', owner: 'Controller' } },
    pilotEdits: { objective: 'Hold material error under 2% across 200 real cases.' },
    experimentEdits: { title: 'Shadow run on last month’s exceptions' },
  }
}

describe('share links', () => {
  it('round-trips every input a user can set', async () => {
    const source = worked()
    const decoded = await decodeShare(await encodeShare(source), BASE)

    expect(typeof decoded).not.toBe('string')
    if (typeof decoded === 'string') return
    expect(decoded.assessment.input).toEqual(source.input)
  })

  it('round-trips notes, decision and the panel edits', async () => {
    const source = worked()
    const decoded = await decodeShare(await encodeShare(source), BASE)
    if (typeof decoded === 'string') throw new Error(decoded)

    expect(decoded.assessment.notes).toBe(source.notes)
    expect(decoded.assessment.decision).toEqual(source.decision)
    expect(decoded.assessment.riskEdits).toEqual(source.riskEdits)
    expect(decoded.assessment.pilotEdits).toEqual(source.pilotEdits)
    expect(decoded.assessment.experimentEdits).toEqual(source.experimentEdits)
  })

  it('preserves which values were reviewed', async () => {
    const source = worked()
    const decoded = await decodeShare(await encodeShare(source), BASE)
    if (typeof decoded === 'string') throw new Error(decoded)

    expect(decoded.assessment.touched.toSorted()).toEqual(source.touched.toSorted())
  })

  it('gives the arrival its own identity rather than the sender’s', async () => {
    const source = { ...worked(), example: true, archived: true }
    const decoded = await decodeShare(await encodeShare(source), BASE)
    if (typeof decoded === 'string') throw new Error(decoded)

    expect(decoded.assessment.id).not.toBe(source.id)
    // A shipped example that travelled is an ordinary assessment on arrival.
    expect(decoded.assessment.example).toBe(false)
    expect(decoded.assessment.archived).toBe(false)
    expect(decoded.assessment.revisions).toEqual([])
  })

  it('reports when the sender scored under different weights', async () => {
    const local = await decodeShare(await encodeShare(worked()), BASE)
    if (typeof local === 'string') throw new Error(local)
    expect(local.foreignModel).toBe(false)

    const foreign = await decodeShare(
      await encodeShare({ ...worked(), modelVersion: 'agentfit-0.9' }),
      BASE,
    )
    if (typeof foreign === 'string') throw new Error(foreign)
    expect(foreign.foreignModel).toBe(true)
    expect(foreign.assessment.modelVersion).toBe('agentfit-0.9')
  })

  it('stays short enough to paste: a blank assessment under 200 characters', async () => {
    const token = await encodeShare(createAssessment('custom'))
    expect(token.length).toBeLessThan(200)
  })

  it('stays reasonable when everything is filled in', async () => {
    const token = await encodeShare(worked())
    expect(token.length).toBeLessThan(1200)
  })

  it('is URL-fragment safe', async () => {
    for (const source of [createAssessment('custom'), worked()]) {
      expect(await encodeShare(source)).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  describe('refuses what it cannot read', () => {
    it('rejects a truncated token', async () => {
      const token = await encodeShare(worked())
      expect(await decodeShare(token.slice(0, token.length - 12), BASE)).toBe('malformed')
    })

    it('rejects an empty or non-base64url token', async () => {
      expect(await decodeShare('A', BASE)).toBe('malformed')
      expect(await decodeShare('A!!!!', BASE)).toBe('malformed')
      expect(await decodeShare('', BASE)).toBe('malformed')
    })

    it('rejects an unknown prefix rather than guessing', async () => {
      expect(await decodeShare('Zabcdef', BASE)).toBe('unsupported-version')
    })

    it('names a future wire version instead of misreading it', async () => {
      // Prefix B is the uncompressed form, so this is a hand-built future token.
      const future = JSON.stringify([99, 'agentfit-2.0', 0, 'x', '', 'custom'])
      const bytes = new TextEncoder().encode(future)
      let binary = ''
      for (const b of bytes) binary += String.fromCharCode(b)
      const token = 'B' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      expect(await decodeShare(token, BASE)).toBe('unsupported-version')
    })

    it('rejects a token whose ratings are out of range', async () => {
      const bad = JSON.stringify([1, 'agentfit-1.0', 0, 'x', '', 'custom', [1, 1, 1, null, null, null], '99999999999999999999', [], 0])
      const bytes = new TextEncoder().encode(bad)
      let binary = ''
      for (const b of bytes) binary += String.fromCharCode(b)
      const token = 'B' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      expect(await decodeShare(token, BASE)).toBe('malformed')
    })
  })

  it('describes what a link carries', () => {
    expect(shareSummary(createAssessment('custom'))).toContain('20 ratings')

    const summary = shareSummary(worked())
    expect(summary).toContain('your notes')
    expect(summary).toContain('the recorded decision')
    expect(summary).toContain('the pilot plan')
  })
})
