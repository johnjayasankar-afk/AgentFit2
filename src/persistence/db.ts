import Dexie, { type Table } from 'dexie'
import type { Assessment, AssessmentInput } from '../domain/types'
import { assessmentSchema, EMPTY_DECISION } from '../domain/types'
import { archetypeInput, EXAMPLE_ARCHETYPE_IDS, ARCHETYPE_BY_ID } from '../domain/archetypes'
import { MODEL_VERSION } from '../engine/version'
import { migrateAll, SCHEMA_VERSION, type MigrationOutcome } from './migrate'
import { ALL_DIMENSION_KEYS } from '../domain/dimensions'
import { ECONOMICS_KEYS } from '../engine/grounding'

class AgentFitDB extends Dexie {
  assessments!: Table<Assessment, string>

  constructor() {
    super('agentfit')
    this.version(1).stores({
      // Indexed: primary key, sort keys, and the archived filter.
      assessments: 'id, updatedAt, createdAt, archived',
    })
  }
}

export const db = new AgentFitDB()

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `af_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createAssessment(archetypeId = 'custom', overrides: Partial<Assessment> = {}): Assessment {
  const now = Date.now()
  const input = archetypeInput(archetypeId)
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    modelVersion: MODEL_VERSION,
    input,
    revisions: [],
    decision: { ...EMPTY_DECISION },
    notes: '',
    touched: [],
    riskEdits: {},
    pilotEdits: {},
    experimentEdits: {},
    archived: false,
    example: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function duplicateAssessment(source: Assessment): Assessment {
  const now = Date.now()
  return {
    ...structuredClone(source),
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    // A copy starts its own history rather than inheriting the original's.
    revisions: [],
    example: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    input: {
      ...structuredClone(source.input),
      definition: {
        ...source.input.definition,
        name: `${source.input.definition.name || 'Untitled workflow'} (copy)`,
      },
    },
  }
}

/**
 * Read the whole table, migrating and validating every record on the way out.
 *
 * Records are stored as written and repaired on read rather than rewritten in
 * place, so a build that cannot understand a record leaves it intact for a
 * later one instead of destroying it. Anything unreadable is reported rather
 * than silently dropped.
 */
export async function readAll(): Promise<MigrationOutcome & { ok: Assessment[] }> {
  const rows = (await db.assessments.toArray()) as unknown[]
  const outcome = migrateAll(rows)
  return { ...outcome, ok: outcome.ok.toSorted((a, b) => b.updatedAt - a.updatedAt) }
}

export async function listAssessments(): Promise<Assessment[]> {
  return (await readAll()).ok
}

export async function saveAssessment(a: Assessment): Promise<void> {
  await db.assessments.put({ ...a, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() })
}

/** Write without advancing `updatedAt` — used for seeding and imports. */
export async function putAssessment(a: Assessment): Promise<void> {
  await db.assessments.put(a)
}

/** Write many records in one transaction. */
export async function putAssessments(items: Assessment[]): Promise<void> {
  await db.assessments.bulkPut(items)
}

export async function deleteAssessment(id: string): Promise<void> {
  await db.assessments.delete(id)
}

export async function getAssessment(id: string): Promise<Assessment | undefined> {
  return db.assessments.get(id)
}

/**
 * In-flight guard. React runs effects twice in development, and two concurrent
 * seeds would each observe an empty table.
 */
let seeding: Promise<Assessment[]> | null = null

/**
 * Seed the worked examples once, on an empty database.
 *
 * Ids are derived from the archetype rather than generated, so a repeated seed
 * overwrites rather than duplicates. Examples are marked `example: true` so the
 * library can label them as shipped rather than authored, and they are never
 * re-seeded once anything else exists — a deleted example staying deleted
 * matters more than the library looking full.
 */
export async function seedExamplesIfEmpty(): Promise<Assessment[]> {
  if (seeding) return seeding
  seeding = (async () => {
    const count = await db.assessments.count()
    if (count > 0) return []
    // Seeded now, staggered so ordering within the batch is stable.
    const epoch = Date.now() - EXAMPLE_ARCHETYPE_IDS.length * 60_000
    const seeded: Assessment[] = EXAMPLE_ARCHETYPE_IDS.map((id, index) => {
      const archetype = ARCHETYPE_BY_ID[id]!
      const created = epoch + index * 60_000
      return {
        ...createAssessment(id),
        id: `example-${id}`,
        // Examples ship reviewed: their values are considered, not defaults.
        touched: TOUCHED_ALL,
        notes: archetype.note,
        example: true,
        createdAt: created,
        updatedAt: created,
      }
    })
    await db.assessments.bulkPut(seeded)
    return seeded
  })()
  try {
    return await seeding
  } finally {
    seeding = null
  }
}

/**
 * Shipped examples are fully specified — their volume and duration are chosen
 * figures, not untouched defaults — so they seed as reviewed on every value the
 * grounding measure tracks.
 */
const TOUCHED_ALL: string[] = [
  ...ALL_DIMENSION_KEYS,
  ECONOMICS_KEYS.volume,
  ECONOMICS_KEYS.minutesPerCase,
]

/** Validate an unknown record before it enters the database. */
export function parseAssessment(value: unknown): Assessment {
  return assessmentSchema.parse(value)
}

export type { AssessmentInput }
