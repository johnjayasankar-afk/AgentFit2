import { z } from "zod";

const scale = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const archetype = z.enum([
  "operations_setup",
  "support_triage",
  "payment_exception",
  "document_review",
  "reconciliation",
  "research",
  "data_analysis",
  "client_onboarding",
  "compliance_review",
  "internal_approval",
  "monitoring",
  "scheduling",
  "software_development",
  "reporting",
  "custom",
]);

const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  actor: z.enum(["human", "system", "either"]),
  action: z.string(),
  systems: z.array(z.string()),
  failureMode: z.string(),
  reversible: z.boolean(),
});

const systemAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  access: z.enum(["none", "read", "write", "admin"]),
  criticality: scale,
  notes: z.string(),
});

export const assessmentInputsSchema = z.object({
  name: z.string(),
  description: z.string(),
  archetype,
  economics: z.object({
    volume: z.number().nonnegative(),
    volumePeriod: z.enum(["day", "week", "month"]),
    minutesPerCase: z.number().nonnegative(),
    peopleInvolved: z.number().nonnegative().nullable(),
    loadedHourlyCost: z.number().nonnegative().nullable(),
    variability: scale,
  }),
  structure: z.object({
    ruleClarity: scale,
    inputStructure: scale,
    contextBreadth: scale,
    exceptionRate: scale,
  }),
  systems: z.object({
    systemAccess: scale,
    toolingReadiness: scale,
    permissionComplexity: scale,
    observability: scale,
    verification: scale,
  }),
  risk: z.object({
    reversibility: scale,
    failureConsequence: scale,
    blastRadius: scale,
    humanJudgment: scale,
    regulatorySensitivity: scale,
  }),
  humanLoop: z.object({
    reviewCost: scale,
    approvalLatency: scale,
    escalationAvailability: scale,
    feedbackAvailability: scale,
  }),
  workflow: z
    .object({ steps: z.array(workflowStepSchema) })
    .optional()
    .transform((value) => value ?? { steps: [] }),
  inventory: z
    .object({ systems: z.array(systemAssetSchema) })
    .optional()
    .transform((value) => value ?? { systems: [] }),
});

export const economicAssumptionsSchema = z.object({
  coverage: z.number().min(0).max(1),
  timeReduction: z.number().min(0).max(1),
  reviewMinutesPerCase: z.number().nonnegative(),
});

export const assessmentRecordSchema = z.object({
  id: z.string().min(1),
  modelVersion: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean().default(false),
  demo: z.boolean().default(false),
  notes: z.string().default(""),
  inputs: assessmentInputsSchema,
  assumptions: economicAssumptionsSchema,
  result: z.unknown(),
  scenarioInputs: assessmentInputsSchema.nullish().transform((value) => value ?? null),
  editedSuccessCriteria: z.array(z.string()).nullish().transform((value) => value ?? null),
  editedRisks: z.unknown().nullish().transform((value) => value ?? null),
  editedFmea: z.unknown().nullish().transform((value) => value ?? null),
  editedPilot: z.unknown().nullish().transform((value) => value ?? null),
});

export const assessmentExportSchema = z.object({
  kind: z.literal("agentfit.assessment"),
  version: z.literal(1),
  exportedAt: z.string(),
  assessment: assessmentRecordSchema,
});

export const workspaceBackupSchema = z.object({
  kind: z.literal("agentfit.workspace"),
  version: z.literal(1),
  exportedAt: z.string(),
  modelVersion: z.string(),
  assessments: z.array(assessmentRecordSchema),
});
