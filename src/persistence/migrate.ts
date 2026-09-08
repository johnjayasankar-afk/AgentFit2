import type { Assessment } from '../domain/types'
import { assessmentSchema } from '../domain/types'
import { MODEL_VERSION } from '../engine/version'

/**
 * Storage-format version.
 *
 * Distinct from `modelVersion`, which records the scoring methodology. This
 * number changes when the *shape* of a stored record changes; the model version
 * changes when the meaning of a score does. A record can be current on one and
 * historical on the other.
 */
export const SCHEMA_VERSION = 3

type Raw = Record<string, unknown>

/**
 * Stepwise migrations, applied in order from the record's own version to the
 * current one. Each step takes the shape it is given and returns the next
 * shape; none of them may throw, because a record that fails to migrate should
 * degrade to a reported skip rather than take the library down with it.
 */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  /**
   * 2 → 3: a place to record what the team decided. Records written before the
   * decision record existed simply had no decision, which is what `undecided`
   * means — so this adds the shape without asserting anything.
   */
  2: (raw) => ({
    ...raw,
    decision:
      typeof raw['decision'] === 'object' && raw['decision'] !== null
        ? raw['decision']
        : { status: 'undecided', chosenLevel: null, owner: '', decidedAt: null, rationale: '', revisit: '' },
    schemaVersion: 3,
  }),

  /**
   * 1 → 2: engineering cost, revision history, and an explicit schema version.
   * Records written before the investment model existed simply had no opinion
   * about build cost, which is exactly what `null` means here.
   */
  1: (raw) => {
    const input = (raw['input'] ?? {}) as Raw
    const economics = (input['economics'] ?? {}) as Raw
    return {
      ...raw,
      input: {
        ...input,
        economics: { engineeringWeeklyCost: null, ...economics },
      },
      revisions: Array.isArray(raw['revisions']) ? raw['revisions'] : [],
      schemaVersion: 2,
    }
  },
}

export interface MigrationOutcome {
  /** Records that parsed, after migration. */
  ok: Assessment[]
  /** Records that could not be repaired, with the reason. */
  skipped: { id: string; reason: string }[]
  /** How many records were actually upgraded. */
  migrated: number
}

function labelOf(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) return 'unknown record'
  const id = (raw as Raw)['id']
  return typeof id === 'string' ? id : 'unknown record'
}

/**
 * Bring one stored record up to the current schema and validate it.
 * Returns `null` when the record cannot be salvaged.
 */
export function migrateOne(raw: unknown): { record: Assessment; migrated: boolean } | null {
  if (typeof raw !== 'object' || raw === null) return null

  let working = { ...(raw as Raw) }
  const from = typeof working['schemaVersion'] === 'number' ? (working['schemaVersion'] as number) : 1
  let migrated = false

  for (let v = from; v < SCHEMA_VERSION; v += 1) {
    const step = MIGRATIONS[v]
    if (!step) return null
    try {
      working = step(working)
      migrated = true
    } catch {
      return null
    }
  }

  // A record from a *newer* schema than this build understands is left alone
  // and validated as-is; unknown keys are stripped rather than rejected, so a
  // forward-versioned record degrades instead of disappearing.
  const parsed = assessmentSchema.safeParse({ ...working, schemaVersion: Math.min(from, SCHEMA_VERSION) })
  if (!parsed.success) return null

  return { record: parsed.data, migrated }
}

/** Migrate and validate a whole table read. Never throws. */
export function migrateAll(rows: unknown[]): MigrationOutcome {
  const ok: Assessment[] = []
  const skipped: { id: string; reason: string }[] = []
  let migrated = 0

  for (const row of rows) {
    const result = migrateOne(row)
    if (!result) {
      skipped.push({ id: labelOf(row), reason: 'unreadable under the current schema' })
      continue
    }
    ok.push(result.record)
    if (result.migrated) migrated += 1
  }

  return { ok, skipped, migrated }
}

/** True when a record was scored under a different methodology than this build. */
export function isForeignModel(a: Assessment): boolean {
  return a.modelVersion !== MODEL_VERSION
}
