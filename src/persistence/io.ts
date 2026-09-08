import { z } from 'zod'
import type { Assessment } from '../domain/types'
import { assessmentSchema } from '../domain/types'
import { MODEL_VERSION } from '../engine/version'
import { assess } from '../engine/assess'
import { newId } from './db'

export const EXPORT_KIND = 'agentfit.export'
export const EXPORT_FORMAT = 1

export const exportFileSchema = z.object({
  kind: z.literal(EXPORT_KIND),
  format: z.literal(EXPORT_FORMAT),
  exportedAt: z.number(),
  modelVersion: z.string(),
  assessments: z.array(assessmentSchema).min(1),
})
export type ExportFile = z.infer<typeof exportFileSchema>

export function buildExport(assessments: Assessment[]): ExportFile {
  return {
    kind: EXPORT_KIND,
    format: EXPORT_FORMAT,
    exportedAt: Date.now(),
    modelVersion: MODEL_VERSION,
    assessments: assessments.map((a) => structuredClone(a)),
  }
}

export interface ImportOutcome {
  ok: boolean
  /** Records that parsed and are ready to write. */
  assessments: Assessment[]
  /** Ids that already exist locally, with fresh ids assigned. */
  renamed: number
  /** Assessments produced by a different model version. */
  foreignVersion: string[]
  error: string | null
}

/**
 * Parse and validate an export file.
 *
 * Nothing is ever overwritten: an incoming record whose id already exists is
 * given a new one, so an import can only ever add. Records carrying a different
 * model version are accepted and reported rather than rejected — the stored
 * inputs stay valid, and the version is what tells you the derived numbers were
 * produced by different weights.
 */
export function parseImport(raw: string, existingIds: Set<string>): ImportOutcome {
  const empty: ImportOutcome = { ok: false, assessments: [], renamed: 0, foreignVersion: [], error: null }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ...empty, error: 'That file is not valid JSON.' }
  }

  // Accept a bare single assessment as well as a wrapped export.
  const single = assessmentSchema.safeParse(json)
  const wrapped = exportFileSchema.safeParse(json)

  let incoming: Assessment[]
  let sourceVersion = MODEL_VERSION
  if (wrapped.success) {
    incoming = wrapped.data.assessments
    sourceVersion = wrapped.data.modelVersion
  } else if (single.success) {
    incoming = [single.data]
    sourceVersion = single.data.modelVersion
  } else {
    const issue = wrapped.error.issues[0]
    return {
      ...empty,
      error: issue
        ? `Not an AgentFit export: ${issue.path.join('.') || 'root'} — ${issue.message.toLowerCase()}.`
        : 'Not a recognisable AgentFit export.',
    }
  }

  let renamed = 0
  const assessments = incoming.map((a) => {
    if (!existingIds.has(a.id)) return a
    renamed += 1
    return { ...a, id: newId() }
  })

  const foreignVersion = [
    ...new Set(assessments.map((a) => a.modelVersion).filter((v) => v !== MODEL_VERSION)),
  ]
  if (foreignVersion.length === 0 && sourceVersion !== MODEL_VERSION) foreignVersion.push(sourceVersion)

  return { ok: true, assessments, renamed, foreignVersion, error: null }
}

export function download(filename: string, contents: string, type = 'application/json'): void {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next frame so Safari has committed the navigation.
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}

export function slug(name: string): string {
  return (name || 'workflow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workflow'
}

const CSV_INJECTION = /^[=+\-@\t\r]/

/** Quote a CSV field, neutralising values a spreadsheet would treat as a formula. */
function csvCell(value: string | number): string {
  const s = String(value)
  const safe = CSV_INJECTION.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export function buildCsv(assessments: Assessment[]): string {
  const header = [
    'Workflow', 'Archetype', 'Agent fit', 'Autonomy level', 'Autonomy', 'Pattern',
    'Readiness', 'Classification', 'Net capacity h/wk', 'Annual capacity h',
    'Annual capacity value', 'Build effort low (wk)', 'Build effort high (wk)',
    'Payback months', 'Return verdict', 'Top risk', 'Next experiment',
    'Model version', 'Updated',
  ]
  const rows = assessments.map((a) => {
    const r = assess(a.input)
    return [
      a.input.definition.name || 'Untitled workflow',
      a.input.definition.archetype,
      r.fit.score,
      r.autonomy.level,
      r.autonomy.displayName,
      r.pattern.pattern.name,
      r.readiness.meta.label,
      r.classification.label,
      r.capacity.netCapacityHours.toFixed(1),
      Math.round(r.capacity.annual.netCapacityHours),
      r.capacity.annual.capacityValue === null ? '' : Math.round(r.capacity.annual.capacityValue),
      r.investment.effortWeeks.mid > 0 ? r.investment.effortWeeks.low : '',
      r.investment.effortWeeks.mid > 0 ? r.investment.effortWeeks.high : '',
      r.investment.paybackMonths === null ? '' : Math.round(r.investment.paybackMonths),
      r.investment.verdict,
      r.risks[0]?.risk ?? '',
      r.experiment.title,
      a.modelVersion,
      new Date(a.updatedAt).toISOString(),
    ].map(csvCell).join(',')
  })
  return [header.map(csvCell).join(','), ...rows].join('\r\n')
}
