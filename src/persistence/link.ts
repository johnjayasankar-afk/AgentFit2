import type { Assessment, AssessmentInput, DimensionKey, Period } from '../domain/types'
import { assessmentSchema, EMPTY_DECISION, PERIOD_LABEL } from '../domain/types'
import { readDimension, writeDimension } from '../domain/dimensions'
import { MODEL_VERSION } from '../engine/version'
import { SCHEMA_VERSION } from './migrate'
import { newId } from './db'

/**
 * Assessments that travel without a server.
 *
 * AgentFit keeps everything on the device, which is the right default for a
 * document that records a team's judgement about its own operations. It also
 * means the product had exactly one way to get an assessment to a colleague:
 * export a file and ask them to import it. For an instrument whose whole point
 * is producing a shared artefact, that is a poor answer.
 *
 * A link carries the assessment in the URL *fragment*. Fragments are not sent
 * to servers — the bytes never leave the two machines that hold the link — so
 * this adds sharing without adding infrastructure, an account, or a party who
 * gets to read the contents. The honest limit is the other side of the same
 * property: the link *is* the data, so whoever holds it holds the assessment,
 * and wherever it is pasted keeps a copy.
 *
 * The wire form is deliberately not the storage form. Storage optimises for
 * being readable by a future version of this product; a link optimises for
 * fitting in a chat message. Twenty ordinals become a twenty-character string,
 * `touched` becomes a bitmask, and trailing empties are dropped — then the
 * whole thing is deflated and base64url'd. A blank assessment costs about 110
 * characters; a fully worked one with a recorded decision, notes and pilot plan
 * costs under 800.
 */

/** Bumped only when the meaning of a slot changes. Old tokens stay readable. */
const WIRE = 1

/**
 * Token prefixes. A single letter, inside the base64url alphabet, so the whole
 * token stays URL- and chat-safe.
 */
const DEFLATED = 'A'
const PLAIN = 'B'

/**
 * The wire order of the twenty ordinals.
 *
 * Declared here rather than reused from the dimension registry on purpose: that
 * list is ordered for presentation and may be reordered by a future cycle,
 * which would silently change the meaning of every link already in circulation.
 * A wire format has to be pinned to something that only changes deliberately.
 */
const WIRE_DIMENSIONS: readonly DimensionKey[] = [
  'economics.variability',
  'structure.ruleClarity',
  'structure.inputStructure',
  'structure.contextBreadth',
  'structure.exceptionRate',
  'structure.humanJudgment',
  'systems.systemAccess',
  'systems.toolingReadiness',
  'systems.observability',
  'systems.verification',
  'systems.permissionComplexity',
  'risk.reversibility',
  'risk.failureConsequence',
  'risk.blastRadius',
  'risk.regulatorySensitivity',
  'risk.dataSensitivity',
  'oversight.reviewCost',
  'oversight.approvalLatencyImpact',
  'oversight.escalationAvailability',
  'oversight.feedbackAvailability',
]

/** `touched` also records the two economics fields, so the mask covers 22 bits. */
const WIRE_TOUCHED: readonly string[] = [
  ...WIRE_DIMENSIONS,
  'economics.volume',
  'economics.minutesPerCase',
]

const PERIODS: readonly Period[] = ['day', 'week', 'month']
const STATUSES = ['undecided', 'proceeding', 'deferred', 'declined'] as const

/* ------------------------------------------------------------------ *
 * base64url over bytes
 * ------------------------------------------------------------------ */

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/* ------------------------------------------------------------------ *
 * Compression, with an honest fallback
 * ------------------------------------------------------------------ */

/**
 * `CompressionStream` is available everywhere this product targets, but a link
 * that fails to generate is worse than a long one. When it is missing the token
 * is written uncompressed under a different prefix, and every decoder can still
 * read both.
 */
function canCompress(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'
}

async function through(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

/**
 * Feed a whole buffer through a transform stream.
 *
 * The writer's own promises are swallowed deliberately. When the payload is
 * corrupt — a link truncated by a chat client, which is the common case — the
 * stream errors on both ends at once; the read side is awaited and becomes the
 * reported failure, and the write side would otherwise surface as an unhandled
 * rejection with no one to catch it.
 */
function pump(pair: CompressionStream | DecompressionStream, bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const writer = pair.writable.getWriter()
  writer.write(bytes).catch(() => {})
  writer.close().catch(() => {})
  return through(pair.readable)
}

function deflate(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>
  return pump(new CompressionStream('deflate-raw'), bytes)
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return new TextDecoder().decode(await pump(new DecompressionStream('deflate-raw'), bytes))
}

/* ------------------------------------------------------------------ *
 * The wire tuple
 * ------------------------------------------------------------------ */

type Slot = unknown

/** True for a slot that carries nothing, so the tail can be trimmed. */
function empty(slot: Slot): boolean {
  if (slot === null || slot === '' || slot === 0) return true
  if (Array.isArray(slot)) return slot.length === 0
  if (typeof slot === 'object') return Object.keys(slot as object).length === 0
  return false
}

function toWire(a: Assessment): Slot[] {
  const { definition, economics, assumptions } = a.input

  const dims = WIRE_DIMENSIONS.map((key) => String(readDimension(a.input, key))).join('')

  let mask = 0
  for (const key of a.touched) {
    const bit = WIRE_TOUCHED.indexOf(key)
    if (bit >= 0) mask |= 1 << bit
  }

  const d = a.decision
  const decision =
    d.status === 'undecided' && !d.owner && !d.rationale && !d.revisit && d.chosenLevel === null
      ? null
      : [
          Math.max(0, STATUSES.indexOf(d.status)),
          d.chosenLevel,
          d.owner,
          d.decidedAt,
          d.rationale,
          d.revisit,
        ]

  const slots: Slot[] = [
    WIRE,
    a.modelVersion,
    a.updatedAt,
    definition.name,
    definition.description,
    definition.archetype,
    [
      economics.volume,
      Math.max(0, PERIODS.indexOf(economics.period)),
      economics.minutesPerCase,
      economics.peopleInvolved,
      economics.loadedHourlyCost,
      economics.engineeringWeeklyCost,
    ],
    dims,
    [
      assumptions.coveragePct,
      assumptions.timeReductionPct,
      assumptions.reviewRatePct,
      assumptions.reviewMinutes,
      assumptions.exceptionMinutes,
    ],
    mask,
    a.notes,
    decision,
    a.riskEdits,
    a.pilotEdits,
    a.experimentEdits,
  ]

  // Trailing empties cost four characters each for nothing. Everything the
  // decoder reads past the end falls back to the same value it would have read.
  while (slots.length > 8 && empty(slots.at(-1))) slots.pop()
  return slots
}

/* --- reading back, defensively ------------------------------------ */

function str(v: Slot, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function num(v: Slot, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function numOrNull(v: Slot): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function arr(v: Slot): Slot[] {
  return Array.isArray(v) ? v : []
}

function obj(v: Slot): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function fromWire(slots: Slot[], base: AssessmentInput): Assessment | null {
  if (num(slots[0], 0) !== WIRE) return null

  const eco = arr(slots[6])
  const asm = arr(slots[8])
  const dims = str(slots[7], 40)
  if (dims.length !== WIRE_DIMENSIONS.length) return null

  let input: AssessmentInput = {
    ...base,
    definition: {
      name: str(slots[3], 120),
      description: str(slots[4], 600),
      archetype: str(slots[5], 60) || 'custom',
    },
    economics: {
      ...base.economics,
      volume: num(eco[0], 0),
      period: PERIODS[num(eco[1], 1)] ?? 'week',
      minutesPerCase: num(eco[2], 0),
      peopleInvolved: numOrNull(eco[3]),
      loadedHourlyCost: numOrNull(eco[4]),
      engineeringWeeklyCost: numOrNull(eco[5]),
    },
    assumptions: {
      coveragePct: numOrNull(asm[0]),
      timeReductionPct: numOrNull(asm[1]),
      reviewRatePct: numOrNull(asm[2]),
      reviewMinutes: numOrNull(asm[3]),
      exceptionMinutes: numOrNull(asm[4]),
    },
  }

  for (const [i, key] of WIRE_DIMENSIONS.entries()) {
    const value = Number(dims[i])
    if (!Number.isInteger(value) || value < 1 || value > 5) return null
    input = writeDimension(input, key, value as 1 | 2 | 3 | 4 | 5)
  }

  const mask = num(slots[9], 0)
  const touched = WIRE_TOUCHED.filter((_, bit) => (mask & (1 << bit)) !== 0)

  const dec = arr(slots[11])
  const decision =
    dec.length === 0
      ? { ...EMPTY_DECISION }
      : {
          status: STATUSES[num(dec[0], 0)] ?? 'undecided',
          chosenLevel: numOrNull(dec[1]),
          owner: str(dec[2], 120),
          decidedAt: numOrNull(dec[3]),
          rationale: str(dec[4], 2000),
          revisit: str(dec[5], 200),
        }

  const now = Date.now()
  const parsed = assessmentSchema.safeParse({
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    modelVersion: str(slots[1], 60) || MODEL_VERSION,
    input,
    revisions: [],
    decision,
    notes: str(slots[10], 4000),
    touched,
    riskEdits: obj(slots[12]),
    pilotEdits: obj(slots[13]),
    experimentEdits: obj(slots[14]),
    archived: false,
    // A shared assessment is never a shipped example, whatever it was at home.
    example: false,
    createdAt: num(slots[2], now),
    updatedAt: num(slots[2], now),
  })

  return parsed.success ? parsed.data : null
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Encode an assessment into a URL-fragment-safe token. */
export async function encodeShare(a: Assessment): Promise<string> {
  const json = JSON.stringify(toWire(a))
  if (!canCompress()) return PLAIN + toBase64Url(new TextEncoder().encode(json))
  try {
    return DEFLATED + toBase64Url(await deflate(json))
  } catch {
    return PLAIN + toBase64Url(new TextEncoder().encode(json))
  }
}

export type ShareFailure = 'malformed' | 'unsupported-version'

export interface ShareDecoded {
  assessment: Assessment
  /** True when the link was made by a build using different scoring weights. */
  foreignModel: boolean
}

/**
 * Decode a token. Returns a reason rather than throwing, because a truncated
 * link pasted out of a chat client is a normal event and deserves a sentence,
 * not a stack trace.
 *
 * `base` supplies the defaults for anything a future wire version might add;
 * passing the neutral archetype keeps an older decoder from inventing values.
 */
export async function decodeShare(
  token: string,
  base: AssessmentInput,
): Promise<ShareDecoded | ShareFailure> {
  const prefix = token.slice(0, 1)
  const body = token.slice(1)
  if (body.length === 0 || !/^[A-Za-z0-9_-]+$/.test(body)) return 'malformed'

  let json: string
  try {
    const bytes = fromBase64Url(body)
    if (prefix === DEFLATED) {
      if (!canCompress()) return 'malformed'
      json = await inflate(bytes)
    } else if (prefix === PLAIN) {
      json = new TextDecoder().decode(bytes)
    } else {
      return 'unsupported-version'
    }
  } catch {
    return 'malformed'
  }

  let slots: unknown
  try {
    slots = JSON.parse(json)
  } catch {
    return 'malformed'
  }
  if (!Array.isArray(slots)) return 'malformed'
  // A token from a future wire version is reported as such rather than read
  // with this version's meanings, which would produce a plausible wrong answer.
  if (num(slots[0], 0) !== WIRE) return 'unsupported-version'

  const assessment = fromWire(slots, base)
  if (!assessment) return 'malformed'

  return { assessment, foreignModel: assessment.modelVersion !== MODEL_VERSION }
}

/** One line describing what a link carries, for the share sheet. */
export function shareSummary(a: Assessment): string {
  const parts: string[] = [
    `${WIRE_DIMENSIONS.length} ratings`,
    `volume ${a.input.economics.volume.toLocaleString('en-US')} ${PERIOD_LABEL[a.input.economics.period]}`,
  ]
  if (a.notes.trim()) parts.push('your notes')
  if (a.decision.status !== 'undecided') parts.push('the recorded decision')
  if (Object.keys(a.riskEdits).length > 0) parts.push('risk mitigations')
  if (Object.keys(a.pilotEdits).length > 0) parts.push('the pilot plan')
  return parts.join(', ')
}

export { WIRE_DIMENSIONS as SHARE_WIRE_DIMENSIONS, WIRE_TOUCHED as SHARE_WIRE_TOUCHED }
