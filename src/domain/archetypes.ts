import type { AssessmentInput } from './types'

export interface Archetype {
  id: string
  label: string
  /** One line shown under the name when selected. */
  note: string
  input: Omit<AssessmentInput, 'definition'> & { definition: { name: string; description: string } }
}

const NEUTRAL_ASSUMPTIONS = {
  coveragePct: null,
  timeReductionPct: null,
  reviewRatePct: null,
  reviewMinutes: null,
  exceptionMinutes: null,
}

type Body = Omit<Archetype['input'], 'definition'>

function make(
  id: string,
  label: string,
  note: string,
  name: string,
  description: string,
  body: Body,
): Archetype {
  return { id, label, note, input: { definition: { name, description }, ...body } }
}

/**
 * Archetypes seed a starting position, not an answer. Every value below is a
 * defensible median for that class of work; none of them are claims about a
 * specific team's workflow, which is why the UI labels them as assumptions and
 * marks untouched dimensions as unreviewed when computing confidence.
 */
export const ARCHETYPES: readonly Archetype[] = [
  make(
    'custom',
    'Custom',
    'A neutral midpoint. Every dimension starts unreviewed.',
    '',
    '',
    {
      economics: { volume: 100, period: 'week', minutesPerCase: 20, peopleInvolved: 1, engineeringWeeklyCost: null, loadedHourlyCost: null, variability: 3 },
      structure: { ruleClarity: 3, inputStructure: 3, contextBreadth: 3, exceptionRate: 3, humanJudgment: 3 },
      systems: { systemAccess: 3, toolingReadiness: 3, observability: 3, verification: 3, permissionComplexity: 3 },
      risk: { reversibility: 3, failureConsequence: 3, blastRadius: 3, regulatorySensitivity: 2, dataSensitivity: 3 },
      oversight: { reviewCost: 3, approvalLatencyImpact: 3, escalationAvailability: 3, feedbackAvailability: 3 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'support-triage',
    'Support triage',
    'High volume, mostly reversible, judgment concentrated in a minority of cases.',
    'Customer support triage',
    'Classify inbound tickets, gather account context, draft a first response, and route anything unusual to a specialist queue.',
    {
      economics: { volume: 900, period: 'week', minutesPerCase: 9, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 48, variability: 3 },
      structure: { ruleClarity: 4, inputStructure: 2, contextBreadth: 3, exceptionRate: 3, humanJudgment: 2 },
      systems: { systemAccess: 4, toolingReadiness: 4, observability: 4, verification: 3, permissionComplexity: 2 },
      risk: { reversibility: 4, failureConsequence: 2, blastRadius: 2, regulatorySensitivity: 1, dataSensitivity: 3 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 4, escalationAvailability: 4, feedbackAvailability: 4 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'payment-exception',
    'Payment exception',
    'Strong economics against irreversible money movement. The canonical high-fit, low-autonomy case.',
    'Payment exception investigation',
    'Investigate failed or mismatched payments, assemble the trail across ledger and processor, determine cause, and apply a correction.',
    {
      economics: { volume: 150, period: 'week', minutesPerCase: 30, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 72, variability: 3 },
      structure: { ruleClarity: 4, inputStructure: 4, contextBreadth: 4, exceptionRate: 3, humanJudgment: 3 },
      systems: { systemAccess: 4, toolingReadiness: 4, observability: 4, verification: 4, permissionComplexity: 4 },
      risk: { reversibility: 2, failureConsequence: 4, blastRadius: 3, regulatorySensitivity: 4, dataSensitivity: 4 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 2, escalationAvailability: 4, feedbackAvailability: 4 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'reconciliation',
    'Reconciliation',
    'Deterministic and structured. Often a rules problem wearing an AI costume.',
    'Month-end reconciliation',
    'Match transactions between ledger and bank statement, flag breaks, and prepare the adjustment schedule.',
    {
      economics: { volume: 20, period: 'month', minutesPerCase: 45, peopleInvolved: 2, engineeringWeeklyCost: 4000, loadedHourlyCost: 65, variability: 2 },
      structure: { ruleClarity: 5, inputStructure: 5, contextBreadth: 2, exceptionRate: 2, humanJudgment: 2 },
      systems: { systemAccess: 5, toolingReadiness: 4, observability: 4, verification: 5, permissionComplexity: 2 },
      risk: { reversibility: 4, failureConsequence: 3, blastRadius: 2, regulatorySensitivity: 3, dataSensitivity: 3 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 1, escalationAvailability: 4, feedbackAvailability: 4 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'document-review',
    'Document review',
    'Unstructured input, moderate stakes. Retrieval matters more than autonomy.',
    'Contract clause review',
    'Read incoming third-party agreements, extract deviations from the standard position, and summarise them for counsel.',
    {
      economics: { volume: 60, period: 'week', minutesPerCase: 40, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 95, variability: 4 },
      structure: { ruleClarity: 3, inputStructure: 1, contextBreadth: 3, exceptionRate: 3, humanJudgment: 4 },
      systems: { systemAccess: 3, toolingReadiness: 2, observability: 3, verification: 2, permissionComplexity: 2 },
      risk: { reversibility: 4, failureConsequence: 3, blastRadius: 2, regulatorySensitivity: 3, dataSensitivity: 4 },
      oversight: { reviewCost: 3, approvalLatencyImpact: 2, escalationAvailability: 3, feedbackAvailability: 2 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'research',
    'Research synthesis',
    'Cheap to be wrong, easy to undo. The rare place broad autonomy is defensible.',
    'Competitive research synthesis',
    'Gather public material on a named topic, extract claims with sources, and produce a structured internal briefing.',
    {
      economics: { volume: 40, period: 'week', minutesPerCase: 75, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 85, variability: 4 },
      structure: { ruleClarity: 3, inputStructure: 2, contextBreadth: 4, exceptionRate: 2, humanJudgment: 3 },
      systems: { systemAccess: 4, toolingReadiness: 4, observability: 4, verification: 3, permissionComplexity: 1 },
      risk: { reversibility: 5, failureConsequence: 1, blastRadius: 1, regulatorySensitivity: 1, dataSensitivity: 1 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 3, escalationAvailability: 3, feedbackAvailability: 3 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'access-provisioning',
    'Access provisioning',
    'Clear rules, dangerous permissions. Controls dominate the recommendation.',
    'Security access request',
    'Evaluate an access request against role policy, check for conflicts, and grant or route for approval.',
    {
      economics: { volume: 120, period: 'week', minutesPerCase: 12, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 78, variability: 2 },
      structure: { ruleClarity: 5, inputStructure: 4, contextBreadth: 3, exceptionRate: 2, humanJudgment: 2 },
      systems: { systemAccess: 4, toolingReadiness: 4, observability: 4, verification: 4, permissionComplexity: 5 },
      risk: { reversibility: 4, failureConsequence: 4, blastRadius: 4, regulatorySensitivity: 4, dataSensitivity: 4 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 3, escalationAvailability: 4, feedbackAvailability: 3 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'compliance-review',
    'Compliance review',
    'A named human is accountable by rule. Assist is usually the ceiling.',
    'Regulatory sign-off review',
    'Assemble the evidence pack for a regulated filing, check completeness against the control matrix, and prepare it for attestation.',
    {
      economics: { volume: 30, period: 'month', minutesPerCase: 120, peopleInvolved: 2, engineeringWeeklyCost: 4000, loadedHourlyCost: 110, variability: 4 },
      structure: { ruleClarity: 3, inputStructure: 2, contextBreadth: 4, exceptionRate: 3, humanJudgment: 5 },
      systems: { systemAccess: 3, toolingReadiness: 2, observability: 3, verification: 2, permissionComplexity: 3 },
      risk: { reversibility: 2, failureConsequence: 5, blastRadius: 4, regulatorySensitivity: 5, dataSensitivity: 4 },
      oversight: { reviewCost: 4, approvalLatencyImpact: 1, escalationAvailability: 3, feedbackAvailability: 2 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'client-onboarding',
    'Client onboarding',
    'Long cases, many systems, moderate stakes. Coverage is the hard part.',
    'Client onboarding review',
    'Collect and verify onboarding documentation, run screening checks, and open accounts across internal systems.',
    {
      economics: { volume: 25, period: 'week', minutesPerCase: 140, peopleInvolved: 2, engineeringWeeklyCost: 4000, loadedHourlyCost: 80, variability: 4 },
      structure: { ruleClarity: 4, inputStructure: 3, contextBreadth: 4, exceptionRate: 3, humanJudgment: 3 },
      systems: { systemAccess: 3, toolingReadiness: 3, observability: 3, verification: 3, permissionComplexity: 3 },
      risk: { reversibility: 3, failureConsequence: 4, blastRadius: 3, regulatorySensitivity: 4, dataSensitivity: 5 },
      oversight: { reviewCost: 3, approvalLatencyImpact: 2, escalationAvailability: 4, feedbackAvailability: 3 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'ops-setup',
    'Operations setup',
    'Repetitive configuration work with good system access.',
    'Operations run setup',
    'Configure a scheduled operational run: assemble parameters, validate against policy, and stage it for execution.',
    {
      economics: { volume: 150, period: 'week', minutesPerCase: 30, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 70, variability: 2 },
      structure: { ruleClarity: 4, inputStructure: 4, contextBreadth: 3, exceptionRate: 2, humanJudgment: 2 },
      systems: { systemAccess: 4, toolingReadiness: 4, observability: 4, verification: 4, permissionComplexity: 3 },
      risk: { reversibility: 4, failureConsequence: 3, blastRadius: 3, regulatorySensitivity: 2, dataSensitivity: 2 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 3, escalationAvailability: 4, feedbackAvailability: 4 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'monitoring',
    'Monitoring',
    'Continuous, low-latency, and intolerant of approval gates.',
    'Production anomaly triage',
    'Watch operational signals, correlate anomalies with recent changes, and open or suppress an incident.',
    {
      economics: { volume: 60, period: 'day', minutesPerCase: 8, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 95, variability: 4 },
      structure: { ruleClarity: 3, inputStructure: 4, contextBreadth: 4, exceptionRate: 3, humanJudgment: 3 },
      systems: { systemAccess: 5, toolingReadiness: 4, observability: 5, verification: 3, permissionComplexity: 3 },
      risk: { reversibility: 4, failureConsequence: 3, blastRadius: 3, regulatorySensitivity: 1, dataSensitivity: 2 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 5, escalationAvailability: 4, feedbackAvailability: 4 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'reporting',
    'Reporting',
    'Structured, scheduled, and largely deterministic.',
    'Recurring management reporting',
    'Pull the period’s figures, apply the standard commentary structure, and circulate the pack.',
    {
      economics: { volume: 12, period: 'month', minutesPerCase: 180, peopleInvolved: 2, engineeringWeeklyCost: 4000, loadedHourlyCost: 75, variability: 2 },
      structure: { ruleClarity: 4, inputStructure: 5, contextBreadth: 3, exceptionRate: 2, humanJudgment: 3 },
      systems: { systemAccess: 4, toolingReadiness: 4, observability: 4, verification: 4, permissionComplexity: 2 },
      risk: { reversibility: 4, failureConsequence: 2, blastRadius: 2, regulatorySensitivity: 2, dataSensitivity: 3 },
      oversight: { reviewCost: 3, approvalLatencyImpact: 1, escalationAvailability: 3, feedbackAvailability: 3 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'scheduling',
    'Scheduling / coordination',
    'Small cases at high frequency. Economics live in the tail.',
    'Field scheduling coordination',
    'Match requests to availability, resolve conflicts, confirm with participants, and update the schedule of record.',
    {
      economics: { volume: 200, period: 'week', minutesPerCase: 7, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 42, variability: 3 },
      structure: { ruleClarity: 4, inputStructure: 3, contextBreadth: 2, exceptionRate: 3, humanJudgment: 2 },
      systems: { systemAccess: 4, toolingReadiness: 3, observability: 3, verification: 3, permissionComplexity: 2 },
      risk: { reversibility: 4, failureConsequence: 2, blastRadius: 2, regulatorySensitivity: 1, dataSensitivity: 2 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 4, escalationAvailability: 3, feedbackAvailability: 3 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'data-analysis',
    'Data analysis',
    'Read-heavy and reversible, but correctness is expensive to establish.',
    'Ad hoc data analysis requests',
    'Interpret a stakeholder question, assemble the query, and return an answer with its caveats.',
    {
      economics: { volume: 45, period: 'week', minutesPerCase: 50, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 90, variability: 4 },
      structure: { ruleClarity: 3, inputStructure: 4, contextBreadth: 4, exceptionRate: 3, humanJudgment: 4 },
      systems: { systemAccess: 4, toolingReadiness: 4, observability: 3, verification: 2, permissionComplexity: 3 },
      risk: { reversibility: 5, failureConsequence: 3, blastRadius: 3, regulatorySensitivity: 1, dataSensitivity: 3 },
      oversight: { reviewCost: 4, approvalLatencyImpact: 2, escalationAvailability: 3, feedbackAvailability: 2 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'software-development',
    'Software development',
    'Excellent verification via tests, with a wide blast radius on write.',
    'Dependency upgrade maintenance',
    'Take a dependency bump, apply the mechanical changes, run the suite, and open a reviewed pull request.',
    {
      economics: { volume: 35, period: 'week', minutesPerCase: 55, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 105, variability: 4 },
      structure: { ruleClarity: 3, inputStructure: 3, contextBreadth: 4, exceptionRate: 3, humanJudgment: 3 },
      systems: { systemAccess: 5, toolingReadiness: 5, observability: 4, verification: 5, permissionComplexity: 3 },
      risk: { reversibility: 5, failureConsequence: 3, blastRadius: 3, regulatorySensitivity: 1, dataSensitivity: 2 },
      oversight: { reviewCost: 3, approvalLatencyImpact: 2, escalationAvailability: 4, feedbackAvailability: 4 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
  make(
    'internal-approval',
    'Internal approval',
    'Short cases, clear policy, and a signature that carries weight.',
    'Expense approval',
    'Check a submitted expense against policy, request missing evidence, and approve or route for exception review.',
    {
      economics: { volume: 300, period: 'week', minutesPerCase: 5, peopleInvolved: 1, engineeringWeeklyCost: 4000, loadedHourlyCost: 60, variability: 2 },
      structure: { ruleClarity: 5, inputStructure: 4, contextBreadth: 2, exceptionRate: 2, humanJudgment: 2 },
      systems: { systemAccess: 4, toolingReadiness: 4, observability: 4, verification: 4, permissionComplexity: 3 },
      risk: { reversibility: 4, failureConsequence: 3, blastRadius: 2, regulatorySensitivity: 3, dataSensitivity: 3 },
      oversight: { reviewCost: 2, approvalLatencyImpact: 3, escalationAvailability: 4, feedbackAvailability: 4 },
      assumptions: NEUTRAL_ASSUMPTIONS,
    },
  ),
]

export const ARCHETYPE_BY_ID = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a])) as Record<
  string,
  Archetype
>

export function archetypeInput(id: string): AssessmentInput {
  const a = ARCHETYPE_BY_ID[id] ?? ARCHETYPE_BY_ID['custom']!
  return {
    definition: { name: a.input.definition.name, description: a.input.definition.description, archetype: a.id },
    economics: { ...a.input.economics },
    structure: { ...a.input.structure },
    systems: { ...a.input.systems },
    risk: { ...a.input.risk },
    oversight: { ...a.input.oversight },
    assumptions: { ...a.input.assumptions },
  }
}

/** Archetypes shipped as worked examples in the library. */
export const EXAMPLE_ARCHETYPE_IDS = [
  'support-triage',
  'payment-exception',
  'research',
  'access-provisioning',
  'compliance-review',
  'reconciliation',
] as const
