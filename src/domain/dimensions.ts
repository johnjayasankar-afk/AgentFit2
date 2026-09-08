import type { DimensionKey, GroupId, Polarity, Score } from './types'
import type { AssessmentInput } from './types'

export interface DimensionMeta {
  key: DimensionKey
  group: GroupId
  label: string
  /** One line. What the number means. */
  definition: string
  /** Anchors for 1..5. Every scale is published; none are unlabelled. */
  anchors: readonly [string, string, string, string, string]
  polarity: Polarity
  /**
   * Whether an organisation can decide to change this.
   *
   * `capability` dimensions describe what you have built and can therefore
   * invest in — access, tooling, verification, rollback, an escalation rota.
   * `constraint` dimensions describe the work or the world: how much judgment
   * a decision needs, what a mistake costs, whether a regulator requires a
   * signature. You do not improve a constraint, you design around it or change
   * the scope of the workflow.
   *
   * The distinction matters because a tool that lists "reduce regulatory
   * sensitivity" as a high-leverage improvement is not giving advice.
   */
  nature: 'capability' | 'constraint'
  /** Expanded rationale, revealed on demand. Two sentences maximum. */
  why: string
}

export const GROUP_META: Record<GroupId, { index: string; label: string; blurb: string }> = {
  economics: {
    index: '01',
    label: 'Economics',
    blurb: 'How much human time the workflow consumes, and how evenly.',
  },
  structure: {
    index: '02',
    label: 'Structure',
    blurb: 'How describable the work is, and how much of it resists description.',
  },
  systems: {
    index: '03',
    label: 'System readiness',
    blurb: 'Whether software can reach the context, act, and be checked.',
  },
  risk: {
    index: '04',
    label: 'Action risk',
    blurb: 'What a wrong action costs, and how far it travels.',
  },
  oversight: {
    index: '05',
    label: 'Human oversight',
    blurb: 'Whether a human loop is actually practical, not just nominal.',
  },
}

export const DIMENSIONS: readonly DimensionMeta[] = [
  /* --- economics ------------------------------------------------ */
  {
    key: 'economics.variability',
    group: 'economics',
    label: 'Case variability',
    definition: 'How much complexity differs from one case to the next.',
    anchors: [
      'Near-identical cases',
      'Minor variation',
      'Moderate variation',
      'Substantial variation',
      'Every case is different',
    ],
    polarity: 'lowers',
    nature: 'constraint',
    why: 'Variability decides whether one solution covers the volume or whether coverage collapses to a narrow subset. It is the difference between an average case and a representative one.',
  },

  /* --- structure ------------------------------------------------ */
  {
    key: 'structure.ruleClarity',
    group: 'structure',
    label: 'Rule clarity',
    definition: 'How completely a correct decision can be written down in advance.',
    anchors: [
      'Mostly tacit or ambiguous',
      'Rules exist but are contested',
      'Mixed rules and judgment',
      'Largely explicit, some edge cases',
      'Explicit and repeatable',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Clear rules make behaviour specifiable and testable. At the very top of this scale a language model may be unnecessary — plain code does the job more cheaply and more predictably.',
  },
  {
    key: 'structure.inputStructure',
    group: 'structure',
    label: 'Input structure',
    definition: 'How consistently the work arrives in a machine-readable shape.',
    anchors: [
      'Free text, calls, scattered attachments',
      'Mostly unstructured with some fields',
      'Semi-structured',
      'Mostly structured, some free text',
      'Structured records and typed fields',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Unstructured input is exactly where language models earn their cost. Fully structured input is usually a parsing problem that conventional software already solves.',
  },
  {
    key: 'structure.contextBreadth',
    group: 'structure',
    label: 'Context breadth',
    definition: 'How much surrounding history and cross-system state a case requires.',
    anchors: [
      'Everything needed is in the case',
      'One adjacent system',
      'A few systems or recent history',
      'Several systems and deep history',
      'Wide cross-system and historical context',
    ],
    polarity: 'lowers',
    nature: 'constraint',
    why: 'Breadth is a demand placed on retrieval, not a property of the model. It only reduces readiness when system access cannot meet it.',
  },
  {
    key: 'structure.exceptionRate',
    group: 'structure',
    label: 'Exception rate',
    definition: 'How often a case falls outside the normal path.',
    anchors: [
      'Rare — under 2%',
      'Occasional — around 5%',
      'Regular — around 15%',
      'Frequent — around 30%',
      'Exceptions are the work',
    ],
    polarity: 'lowers',
    nature: 'capability',
    why: 'Exceptions set the ceiling on unattended coverage and the floor on escalation volume. A high rate makes autonomy expensive even when every other signal is strong.',
  },
  {
    key: 'structure.humanJudgment',
    group: 'structure',
    label: 'Human judgment',
    definition: 'How much of the decision is irreducibly a person’s call.',
    anchors: [
      'Mechanical',
      'Light discretion',
      'Structured professional judgment',
      'Substantial expertise required',
      'Expert judgment is the deliverable',
    ],
    polarity: 'lowers',
    nature: 'constraint',
    why: 'Where judgment is the product, automating around it removes the thing of value. Moderate structured judgment is the sweet spot — enough ambiguity to need a model, enough structure to constrain it.',
  },

  /* --- systems -------------------------------------------------- */
  {
    key: 'systems.systemAccess',
    group: 'systems',
    label: 'System / data access',
    definition: 'Whether software can programmatically reach the context a case needs.',
    anchors: [
      'Manual lookup, screens, or paper',
      'Exports and manual joins',
      'Partial API coverage',
      'Good coverage, some gaps',
      'Reliable programmatic access',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Without access there is no agent, only a chat window next to the real work. This is the most common reason a promising workflow is not yet buildable.',
  },
  {
    key: 'systems.toolingReadiness',
    group: 'systems',
    label: 'Tooling readiness',
    definition: 'Whether actions exist as stable, typed, callable interfaces.',
    anchors: [
      'No usable interfaces',
      'Brittle scripts or UI automation',
      'Some APIs, inconsistent contracts',
      'Stable APIs, partial typing',
      'Stable typed interfaces',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Typed tools are what convert an intention into a bounded, reviewable action. Untyped surfaces make every permission grant broader than intended.',
  },
  {
    key: 'systems.observability',
    group: 'systems',
    label: 'Observability',
    definition: 'How completely you can reconstruct what happened, after the fact.',
    anchors: [
      'Outcomes are largely invisible',
      'Partial logs, no correlation',
      'Logs exist, reconstruction is manual',
      'Traceable with effort',
      'Fully traceable per case',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Autonomy without traceability is unreviewable by construction. You cannot run an incident review on a system that cannot say what it did.',
  },
  {
    key: 'systems.verification',
    group: 'systems',
    label: 'Verification',
    definition: 'How cheaply correctness can be established before or after acting.',
    anchors: [
      'Correctness is hard to determine',
      'Only a domain expert can judge',
      'Human review usually settles it',
      'Mostly checkable programmatically',
      'Cheap deterministic check exists',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Verification is what converts probabilistic output into a dependable step. It is the single highest-leverage investment for raising autonomy safely.',
  },
  {
    key: 'systems.permissionComplexity',
    group: 'systems',
    label: 'Permission complexity',
    definition: 'How privileged and hard to scope the required access is.',
    anchors: [
      'Simple, narrow, read-mostly',
      'Modest scope, easily bounded',
      'Several systems, mixed scopes',
      'Broad or privileged access',
      'Highly privileged, hard to scope',
    ],
    polarity: 'lowers',
    nature: 'capability',
    why: 'The blast radius of a mistake is bounded by what the credentials allow, not by what the agent intended. Broad scopes turn small errors into large ones.',
  },

  /* --- risk ----------------------------------------------------- */
  {
    key: 'risk.reversibility',
    group: 'risk',
    label: 'Reversibility',
    definition: 'How cheaply a wrong action can be undone.',
    anchors: [
      'Effectively irreversible',
      'Reversible at high cost',
      'Reversible with effort',
      'Reversible cheaply',
      'Trivially reversible',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Reversibility is what makes an error a cost rather than an incident. It buys more autonomy than model quality ever will.',
  },
  {
    key: 'risk.failureConsequence',
    group: 'risk',
    label: 'Failure consequence',
    definition: 'What a single wrong action costs when it goes uncaught.',
    anchors: [
      'Negligible',
      'Minor rework',
      'Material but contained',
      'Serious financial or customer harm',
      'Severe — legal, safety, or capital',
    ],
    polarity: 'lowers',
    nature: 'constraint',
    why: 'Consequence sets how much evidence is required before removing a human. High consequence does not disqualify an agent; it disqualifies an unsupervised one.',
  },
  {
    key: 'risk.blastRadius',
    group: 'risk',
    label: 'Blast radius',
    definition: 'How far a single failure propagates before someone notices.',
    anchors: [
      'One low-impact record',
      'One customer or account',
      'A batch or a team',
      'Many customers or a business line',
      'Systemic exposure',
    ],
    polarity: 'lowers',
    nature: 'constraint',
    why: 'Automation multiplies throughput, including the throughput of mistakes. A wide radius requires rate limits and reconciliation before it requires a better model.',
  },
  {
    key: 'risk.regulatorySensitivity',
    group: 'risk',
    label: 'Regulatory sensitivity',
    definition: 'How constrained the workflow is by policy, regulation, or audit.',
    anchors: [
      'No specific constraints',
      'Internal policy only',
      'Documented control requirements',
      'Regulated with audit obligations',
      'Attestation or sign-off required by rule',
    ],
    polarity: 'lowers',
    nature: 'constraint',
    why: 'Some decisions require a named accountable human by rule, regardless of how well the system performs. Where that is true, autonomy is a compliance question, not an engineering one.',
  },
  {
    key: 'risk.dataSensitivity',
    group: 'risk',
    label: 'Data sensitivity',
    definition: 'How sensitive the information the workflow must handle is.',
    anchors: [
      'Non-sensitive internal data',
      'Internal confidential',
      'Customer personal data',
      'Financial, health, or credential data',
      'Highly restricted or special category',
    ],
    polarity: 'lowers',
    nature: 'constraint',
    why: 'Sensitivity constrains where context may travel and what may be retained. It shapes the architecture long before it shapes the autonomy level.',
  },

  /* --- oversight ------------------------------------------------ */
  {
    key: 'oversight.reviewCost',
    group: 'oversight',
    label: 'Review cost',
    definition: 'How much effort it takes a human to check one case properly.',
    anchors: [
      'Glanceable',
      'Under a minute',
      'A few minutes',
      'Substantial re-work of the case',
      'Reviewing costs as much as doing',
    ],
    polarity: 'lowers',
    nature: 'capability',
    why: 'When review costs as much as the work, human-in-the-loop returns nothing and quietly degrades into rubber-stamping. That is worse than no gate, because it looks like a control.',
  },
  {
    key: 'oversight.approvalLatencyImpact',
    group: 'oversight',
    label: 'Approval latency impact',
    definition: 'How much of the benefit disappears if every action waits for approval.',
    anchors: [
      'None — the work is not time-critical',
      'Slight delay is tolerable',
      'Noticeable erosion of value',
      'Most of the benefit is lost',
      'Approval defeats the purpose',
    ],
    polarity: 'tension',
    nature: 'constraint',
    why: 'This is the argument for autonomy, not evidence of readiness for it. When it is high and controls are weak, the honest answer is to fix the controls rather than to remove the gate.',
  },
  {
    key: 'oversight.escalationAvailability',
    group: 'oversight',
    label: 'Escalation availability',
    definition: 'Whether an informed human is actually reachable when a case goes wrong.',
    anchors: [
      'No defined path',
      'Ad hoc, often unavailable',
      'Available in business hours',
      'Defined path, good coverage',
      'Staffed for the workflow’s hours',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Every autonomy level above supervised assumes exceptions leave the system. If nobody catches them, the exception path is a queue that grows.',
  },
  {
    key: 'oversight.feedbackAvailability',
    group: 'oversight',
    label: 'Feedback availability',
    definition: 'Whether real outcomes come back and can improve future decisions.',
    anchors: [
      'Outcomes never observed',
      'Anecdotal only',
      'Sampled or delayed',
      'Most outcomes captured',
      'Outcomes captured per case',
    ],
    polarity: 'raises',
    nature: 'capability',
    why: 'Without an outcome signal there is no basis for ever raising autonomy — performance claims stay unfalsifiable. It is the prerequisite for earning trust rather than asserting it.',
  },
] as const

export const DIMENSION_BY_KEY: Record<DimensionKey, DimensionMeta> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, d]),
) as Record<DimensionKey, DimensionMeta>

export const DIMENSIONS_BY_GROUP: Record<GroupId, DimensionMeta[]> = DIMENSIONS.reduce(
  (acc, d) => {
    acc[d.group].push(d)
    return acc
  },
  { economics: [], structure: [], systems: [], risk: [], oversight: [] } as Record<
    GroupId,
    DimensionMeta[]
  >,
)

/** Read a 1–5 dimension out of an assessment input by its `group.field` key. */
export function readDimension(input: AssessmentInput, key: DimensionKey): Score {
  const [group, field] = key.split('.') as [GroupId, string]
  return (input[group] as unknown as Record<string, Score>)[field] as Score
}

/** Return a copy of `input` with one 1–5 dimension replaced. */
export function writeDimension(
  input: AssessmentInput,
  key: DimensionKey,
  value: Score,
): AssessmentInput {
  const [group, field] = key.split('.') as [GroupId, string]
  return {
    ...input,
    [group]: { ...(input[group] as object), [field]: value },
  } as AssessmentInput
}

export const ALL_DIMENSION_KEYS: DimensionKey[] = DIMENSIONS.map((d) => d.key)
