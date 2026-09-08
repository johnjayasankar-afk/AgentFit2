import { z } from 'zod'

/**
 * AgentFit domain model.
 *
 * Everything a user enters lives in `AssessmentInput`. Everything the product
 * asserts is derived from that input by pure functions in `src/engine`, tagged
 * with the `modelVersion` that produced it. Derived state is never the source
 * of truth — it can always be regenerated from inputs + model version.
 */

/**
 * Every judgement dimension in AgentFit is a 1–5 ordinal with published anchors.
 * Declared as a literal union rather than a bounded integer so the narrow type
 * survives inference and the engines can exhaustively key on it.
 */
export const scoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])
export type Score = z.infer<typeof scoreSchema>

export const periodSchema = z.enum(['day', 'week', 'month'])
export type Period = z.infer<typeof periodSchema>

export const PERIOD_PER_YEAR: Record<Period, number> = {
  day: 250, // working days
  week: 52,
  month: 12,
}

export const PERIOD_LABEL: Record<Period, string> = {
  day: 'per day',
  week: 'per week',
  month: 'per month',
}

/* ------------------------------------------------------------------ *
 * Input groups
 * ------------------------------------------------------------------ */

export const definitionSchema = z.object({
  name: z.string().max(120),
  description: z.string().max(600),
  archetype: z.string(),
})
export type WorkflowDefinition = z.infer<typeof definitionSchema>

export const economicsSchema = z.object({
  /** Cases handled per `period`. */
  volume: z.number().min(0).max(1_000_000),
  period: periodSchema,
  /** Average hands-on human minutes per case, across all participants. */
  minutesPerCase: z.number().min(0).max(10_000),
  /** Optional. Number of people who touch a single case. */
  peopleInvolved: z.number().min(1).max(200).nullable(),
  /** Optional. Fully loaded cost per human hour, in the workspace currency. */
  loadedHourlyCost: z.number().min(0).max(10_000).nullable(),
  /**
   * Optional. Fully loaded cost of one engineer-week, in the same currency.
   * Supplied separately from the workflow's hourly cost because the people who
   * would build the system are rarely the people who run the workflow.
   */
  engineeringWeeklyCost: z.number().min(0).max(1_000_000).nullable().default(null),
  /** How much case-to-case complexity varies. */
  variability: scoreSchema,
})
export type WorkflowEconomics = z.infer<typeof economicsSchema>

export const structureSchema = z.object({
  ruleClarity: scoreSchema,
  inputStructure: scoreSchema,
  contextBreadth: scoreSchema,
  exceptionRate: scoreSchema,
  humanJudgment: scoreSchema,
})
export type WorkflowStructure = z.infer<typeof structureSchema>

export const systemsSchema = z.object({
  systemAccess: scoreSchema,
  toolingReadiness: scoreSchema,
  observability: scoreSchema,
  verification: scoreSchema,
  permissionComplexity: scoreSchema,
})
export type SystemReadiness = z.infer<typeof systemsSchema>

export const riskSchema = z.object({
  reversibility: scoreSchema,
  failureConsequence: scoreSchema,
  blastRadius: scoreSchema,
  regulatorySensitivity: scoreSchema,
  dataSensitivity: scoreSchema,
})
export type ActionRisk = z.infer<typeof riskSchema>

export const oversightSchema = z.object({
  reviewCost: scoreSchema,
  /** 5 = requiring approval would erase most of the workflow benefit. */
  approvalLatencyImpact: scoreSchema,
  escalationAvailability: scoreSchema,
  feedbackAvailability: scoreSchema,
})
export type HumanOversight = z.infer<typeof oversightSchema>

/**
 * Capacity assumptions. `null` means "use the value the model derives from the
 * assessment"; a number means the user has overridden it. Storing the
 * distinction keeps derived defaults live as other inputs change, while making
 * every override explicit and visible.
 */
export const assumptionsSchema = z.object({
  /** Share of cases the system handles end-to-end without hand-off. */
  coveragePct: z.number().min(0).max(100).nullable(),
  /** Share of hands-on time removed on covered cases. */
  timeReductionPct: z.number().min(0).max(100).nullable(),
  /** Share of covered cases a human reviews. */
  reviewRatePct: z.number().min(0).max(100).nullable(),
  /** Human minutes spent reviewing one reviewed case. */
  reviewMinutes: z.number().min(0).max(600).nullable(),
  /** Human minutes spent handling one escalated exception. */
  exceptionMinutes: z.number().min(0).max(600).nullable(),
})
export type CapacityAssumptions = z.infer<typeof assumptionsSchema>

/* ------------------------------------------------------------------ *
 * Assessment
 * ------------------------------------------------------------------ */

export const riskRegisterEditSchema = z.object({
  mitigation: z.string().max(600).optional(),
  owner: z.string().max(120).optional(),
  dismissed: z.boolean().optional(),
})
export type RiskRegisterEdit = z.infer<typeof riskRegisterEditSchema>

export const pilotEditSchema = z.object({
  objective: z.string().max(600).optional(),
  scope: z.string().max(600).optional(),
  users: z.string().max(600).optional(),
  allowed: z.string().max(1200).optional(),
  disallowed: z.string().max(1200).optional(),
  approvalBoundary: z.string().max(600).optional(),
  fallback: z.string().max(600).optional(),
  logging: z.string().max(600).optional(),
  duration: z.string().max(200).optional(),
  exitCriteria: z.string().max(1200).optional(),
})
export type PilotEdit = z.infer<typeof pilotEditSchema>

export const experimentEditSchema = z.object({
  title: z.string().max(200).optional(),
  criteria: z.array(z.string().max(300)).max(12).optional(),
})
export type ExperimentEdit = z.infer<typeof experimentEditSchema>

export const assessmentInputSchema = z.object({
  definition: definitionSchema,
  economics: economicsSchema,
  structure: structureSchema,
  systems: systemsSchema,
  risk: riskSchema,
  oversight: oversightSchema,
  assumptions: assumptionsSchema,
})
export type AssessmentInput = z.infer<typeof assessmentInputSchema>

/**
 * A point-in-time snapshot, written on every save. Only inputs are stored —
 * derived figures are recomputed for display — but the model version that was
 * current when the revision was taken travels with it, so a historical record
 * can say when it predates the weights being used to read it.
 */
export const revisionSchema = z.object({
  at: z.number(),
  modelVersion: z.string(),
  input: assessmentInputSchema,
  notes: z.string().max(4000).default(''),
})
export type Revision = z.infer<typeof revisionSchema>

/** Bounded so a long-lived assessment cannot grow without limit. */
export const MAX_REVISIONS = 20

/**
 * What the team actually decided.
 *
 * AgentFit produces a recommendation; it does not make the decision, and a real
 * team frequently lands somewhere else — proceeding at a different autonomy
 * level, deferring, or declining outright. Without somewhere to record that,
 * the assessment is a calculator output rather than a decision record, and the
 * reason for any divergence lives only in someone's memory.
 */
export const decisionStatusSchema = z.enum(['undecided', 'proceeding', 'deferred', 'declined'])
export type DecisionStatus = z.infer<typeof decisionStatusSchema>

export const decisionSchema = z.object({
  status: decisionStatusSchema.default('undecided'),
  /** The level the team chose. Null means they accepted the recommendation. */
  chosenLevel: z.number().int().min(0).max(5).nullable().default(null),
  /** Who is accountable for the decision. */
  owner: z.string().max(120).default(''),
  decidedAt: z.number().nullable().default(null),
  /** Why, in the team's own words. Especially important when it diverges. */
  rationale: z.string().max(2000).default(''),
  /** Free text for when the decision should be revisited. */
  revisit: z.string().max(200).default(''),
})
export type Decision = z.infer<typeof decisionSchema>

export const EMPTY_DECISION: Decision = {
  status: 'undecided',
  chosenLevel: null,
  owner: '',
  decidedAt: null,
  rationale: '',
  revisit: '',
}

export const assessmentSchema = z.object({
  id: z.string(),
  /** Storage-format version, independent of the scoring `modelVersion`. */
  schemaVersion: z.number().int().min(1).default(1),
  modelVersion: z.string(),
  input: assessmentInputSchema,
  /** Newest first. Written on save, never on edit. */
  revisions: z.array(revisionSchema).max(MAX_REVISIONS).default([]),
  decision: decisionSchema.default(EMPTY_DECISION),
  notes: z.string().max(4000).default(''),
  /** Dimension keys the user has explicitly adjusted. Drives confidence. */
  touched: z.array(z.string()).default([]),
  riskEdits: z.record(z.string(), riskRegisterEditSchema).default({}),
  pilotEdits: pilotEditSchema.default({}),
  experimentEdits: experimentEditSchema.default({}),
  archived: z.boolean().default(false),
  /** True for assessments seeded from shipped examples. */
  example: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type Assessment = z.infer<typeof assessmentSchema>

/* ------------------------------------------------------------------ *
 * Dimension registry keys
 * ------------------------------------------------------------------ */

export const DIMENSION_GROUPS = [
  'economics',
  'structure',
  'systems',
  'risk',
  'oversight',
] as const
export type GroupId = (typeof DIMENSION_GROUPS)[number]

/** Keys of every 1–5 ordinal dimension, addressed as `group.field`. */
export type DimensionKey =
  | 'economics.variability'
  | 'structure.ruleClarity'
  | 'structure.inputStructure'
  | 'structure.contextBreadth'
  | 'structure.exceptionRate'
  | 'structure.humanJudgment'
  | 'systems.systemAccess'
  | 'systems.toolingReadiness'
  | 'systems.observability'
  | 'systems.verification'
  | 'systems.permissionComplexity'
  | 'risk.reversibility'
  | 'risk.failureConsequence'
  | 'risk.blastRadius'
  | 'risk.regulatorySensitivity'
  | 'risk.dataSensitivity'
  | 'oversight.reviewCost'
  | 'oversight.approvalLatencyImpact'
  | 'oversight.escalationAvailability'
  | 'oversight.feedbackAvailability'

/**
 * Directionality of a dimension with respect to *autonomy readiness*.
 * `tension` marks dimensions that are neither — they raise the pressure for
 * autonomy without conferring any of the readiness that would justify it.
 */
export type Polarity = 'raises' | 'lowers' | 'tension'
