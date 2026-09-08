import { describe, expect, it } from 'vitest'
import { buildCsv, buildExport, parseImport, slug } from './io'
import type { Assessment } from '../domain/types'
import { archetypeInput } from '../domain/archetypes'
import { MODEL_VERSION } from '../engine/version'
import { SCHEMA_VERSION } from './migrate'
import { EMPTY_DECISION } from '../domain/types'

function record(id: string, archetype = 'payment-exception'): Assessment {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    modelVersion: MODEL_VERSION,
    input: archetypeInput(archetype),
    revisions: [],
    decision: { ...EMPTY_DECISION },
    notes: '',
    touched: [],
    riskEdits: {},
    pilotEdits: {},
    experimentEdits: {},
    archived: false,
    example: false,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
}

const json = (a: Assessment[]) => JSON.stringify(buildExport(a))

describe('export and import', () => {
  it('round-trips an assessment without loss', () => {
    const original = record('a1')
    const outcome = parseImport(json([original]), new Set())
    expect(outcome.ok).toBe(true)
    expect(outcome.assessments).toHaveLength(1)
    expect(outcome.assessments[0]).toEqual(original)
  })

  it('round-trips every field a user can edit', () => {
    const rich: Assessment = {
      ...record('a2'),
      notes: 'Discussed with the payments team on Tuesday.',
      touched: ['risk.reversibility', 'systems.verification'],
      riskEdits: { 'irreversible-action': { mitigation: 'Two-person release.', owner: 'Ops' } },
      pilotEdits: { objective: 'Prove the approval boundary holds.' },
      experimentEdits: { title: 'Shadow-run for four weeks', criteria: ['No writes', '200 cases'] },
      archived: true,
    }
    const outcome = parseImport(json([rich]), new Set())
    expect(outcome.assessments[0]).toEqual(rich)
  })

  it('never overwrites: a colliding id is reassigned', () => {
    const outcome = parseImport(json([record('dup')]), new Set(['dup']))
    expect(outcome.ok).toBe(true)
    expect(outcome.renamed).toBe(1)
    expect(outcome.assessments[0]!.id).not.toBe('dup')
  })

  it('leaves non-colliding ids alone', () => {
    const outcome = parseImport(json([record('fresh')]), new Set(['other']))
    expect(outcome.renamed).toBe(0)
    expect(outcome.assessments[0]!.id).toBe('fresh')
  })

  it('accepts a bare single assessment as well as a wrapped export', () => {
    const outcome = parseImport(JSON.stringify(record('bare')), new Set())
    expect(outcome.ok).toBe(true)
    expect(outcome.assessments[0]!.id).toBe('bare')
  })

  it('reports records scored under a different model version', () => {
    const foreign = { ...record('old'), modelVersion: 'agentfit-0.9' }
    const outcome = parseImport(json([foreign]), new Set())
    expect(outcome.ok).toBe(true)
    expect(outcome.foreignVersion).toContain('agentfit-0.9')
  })

  it('rejects malformed JSON with a readable message', () => {
    const outcome = parseImport('{not json', new Set())
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toMatch(/not valid JSON/i)
    expect(outcome.assessments).toHaveLength(0)
  })

  it('rejects a file that is not an AgentFit export', () => {
    const outcome = parseImport(JSON.stringify({ hello: 'world' }), new Set())
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toMatch(/not an agentfit export/i)
  })

  it('rejects an export whose records fail validation, naming the field', () => {
    const broken = { kind: 'agentfit.export', format: 1, exportedAt: 1, modelVersion: 'x', assessments: [{ id: 'z' }] }
    const outcome = parseImport(JSON.stringify(broken), new Set())
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toMatch(/modelVersion/)
  })

  it('rejects an out-of-range dimension value', () => {
    const bad = record('bad')
    const mutated = structuredClone(bad) as unknown as { input: { risk: { reversibility: number } } }
    mutated.input.risk.reversibility = 9
    const outcome = parseImport(JSON.stringify(buildExport([mutated as unknown as Assessment])), new Set())
    expect(outcome.ok).toBe(false)
  })
})

describe('CSV export', () => {
  it('emits a header and one row per assessment', () => {
    const csv = buildCsv([record('a', 'payment-exception'), record('b', 'reconciliation')])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('"Agent fit"')
    expect(lines[1]).toContain('Payment exception investigation')
  })

  it('neutralises values a spreadsheet would execute as a formula', () => {
    const risky = record('x')
    risky.input.definition.name = '=HYPERLINK("http://evil","click")'
    const csv = buildCsv([risky])
    expect(csv).toContain(`"'=HYPERLINK`)
    expect(csv).not.toContain('"=HYPERLINK')
  })

  it('escapes embedded quotes', () => {
    const quoted = record('q')
    quoted.input.definition.name = 'The "urgent" queue'
    expect(buildCsv([quoted])).toContain('"The ""urgent"" queue"')
  })

  it('leaves the capacity value blank when no hourly cost is set', () => {
    const noCost = record('n')
    noCost.input.economics.loadedHourlyCost = null
    const row = buildCsv([noCost]).split('\r\n')[1]!
    expect(row).toContain('""')
  })
})

describe('filename slugs', () => {
  it('produces a safe slug', () => {
    expect(slug('Payment exception — investigation!')).toBe('payment-exception-investigation')
  })

  it('falls back when the name is empty or unusable', () => {
    expect(slug('')).toBe('workflow')
    expect(slug('!!!')).toBe('workflow')
  })

  it('bounds the length', () => {
    expect(slug('a'.repeat(200)).length).toBeLessThanOrEqual(60)
  })
})
