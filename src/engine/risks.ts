import type { AssessmentInput } from '../domain/types'
import type { AutonomyResult } from './autonomy'

export type Severity = 'low' | 'moderate' | 'high' | 'critical'

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, moderate: 2, low: 3 }

export interface RiskEntry {
  id: string
  risk: string
  /** Why it exists for *this* workflow, referencing the inputs that created it. */
  because: string
  severity: Severity
  mitigation: string
}

interface Rule {
  id: string
  applies: (i: AssessmentInput, a: AutonomyResult) => boolean
  build: (i: AssessmentInput, a: AutonomyResult) => Omit<RiskEntry, 'id'>
}

const rules: Rule[] = [
  {
    id: 'irreversible-action',
    applies: (i, a) => i.risk.reversibility <= 2 && a.level >= 2,
    build: (i) => ({
      risk: 'Irreversible action',
      because: `Reversibility is ${i.risk.reversibility}/5 — a wrong action cannot be cheaply withdrawn once committed.`,
      severity: i.risk.failureConsequence >= 4 ? 'critical' : 'high',
      mitigation: 'Insert an approval gate before commit, and inspect a simulated diff rather than a description of the intended change.',
    }),
  },
  {
    id: 'weak-verification',
    applies: (i, a) => i.systems.verification <= 2 && a.level >= 2,
    build: (i) => ({
      risk: 'Unverifiable output',
      because: `Verification is ${i.systems.verification}/5 — a wrong result may not be distinguishable from a right one at review time.`,
      severity: i.risk.failureConsequence >= 4 ? 'critical' : 'high',
      mitigation: 'Build a deterministic post-condition check for the subset of cases where one is possible, and route everything else to a person.',
    }),
  },
  {
    id: 'broad-permissions',
    applies: (i, a) => i.systems.permissionComplexity >= 4 && a.level >= 3,
    build: (i) => ({
      risk: 'Broad write permissions',
      because: `Permission complexity is ${i.systems.permissionComplexity}/5 — credentials reach further than this workflow requires.`,
      severity: i.risk.blastRadius >= 4 ? 'critical' : 'high',
      mitigation: 'Issue workflow-specific credentials scoped to the exact records and operations needed, and enforce the tool allowlist at the boundary rather than in the prompt.',
    }),
  },
  {
    id: 'blast-radius',
    applies: (i, a) => i.risk.blastRadius >= 4 && a.level >= 3,
    build: (i) => ({
      risk: 'Wide blast radius',
      because: `Blast radius is ${i.risk.blastRadius}/5 — a systematic error reaches many parties before anyone notices.`,
      severity: i.risk.blastRadius === 5 ? 'critical' : 'high',
      mitigation: 'Cap actions per interval so a systematic error stays small during discovery, and reconcile effects against expected state on a schedule.',
    }),
  },
  {
    id: 'poor-observability',
    applies: (i) => i.systems.observability <= 2,
    build: (i) => ({
      risk: 'Limited observability',
      because: `Observability is ${i.systems.observability}/5 — reconstructing a case after the fact would be manual and incomplete.`,
      severity: 'high',
      mitigation: 'Emit a structured per-case trace covering inputs, retrieved context, tool calls, and outcome before any execution capability ships.',
    }),
  },
  {
    id: 'no-escalation',
    applies: (i) => i.oversight.escalationAvailability <= 2,
    build: (i) => ({
      risk: 'No escalation path',
      because: `Escalation availability is ${i.oversight.escalationAvailability}/5 — exceptions have nowhere reliable to go.`,
      severity: 'high',
      mitigation: 'Name an owner and a queue for declined cases, with a service expectation, before enabling any unattended step.',
    }),
  },
  {
    id: 'sensitive-context',
    applies: (i) => i.risk.dataSensitivity >= 4,
    build: (i) => ({
      risk: 'Sensitive data in context',
      because: `Data sensitivity is ${i.risk.dataSensitivity}/5 — retrieval will pull restricted fields into the working context.`,
      severity: i.risk.dataSensitivity === 5 ? 'high' : 'moderate',
      mitigation: 'Restrict retrieval to the fields the decision requires, redact at the boundary, and bound retention of the trace.',
    }),
  },
  {
    id: 'regulatory',
    applies: (i) => i.risk.regulatorySensitivity >= 4,
    build: (i) => ({
      risk: 'Regulated decision',
      because: `Regulatory sensitivity is ${i.risk.regulatorySensitivity}/5 — the outcome carries policy or audit obligations.`,
      severity: i.risk.regulatorySensitivity === 5 ? 'high' : 'moderate',
      mitigation: 'Keep a named accountable approver in the record and retain the evidence trail in whatever form the obligation specifies.',
    }),
  },
  {
    id: 'review-theatre',
    applies: (i, a) => i.oversight.reviewCost >= 4 && a.level >= 3,
    build: (i) => ({
      risk: 'Approval becomes a rubber stamp',
      because: `Review cost is ${i.oversight.reviewCost}/5 — a reviewer under volume pressure will approve without genuinely checking.`,
      severity: 'high',
      mitigation: 'Reduce what the approver must read: show a validated diff and the specific checks that passed, and measure approval dwell time as a control metric.',
    }),
  },
  {
    id: 'exception-volume',
    applies: (i) => i.structure.exceptionRate >= 4,
    build: (i) => ({
      risk: 'Exception queue growth',
      because: `Exception rate is ${i.structure.exceptionRate}/5 — a large share of cases will be handed back.`,
      severity: 'moderate',
      mitigation: 'Size the escalation queue against expected volume before launch, and treat queue depth as a launch-blocking metric.',
    }),
  },
  {
    id: 'no-feedback',
    applies: (i) => i.oversight.feedbackAvailability <= 2,
    build: (i) => ({
      risk: 'Unfalsifiable performance',
      because: `Feedback availability is ${i.oversight.feedbackAvailability}/5 — real outcomes do not return to the system.`,
      severity: 'moderate',
      mitigation: 'Capture the resolved outcome per case, even manually at first. Without it there is no basis for ever raising autonomy.',
    }),
  },
  {
    id: 'coverage-optimism',
    applies: (i) => i.economics.variability >= 4 && i.structure.exceptionRate >= 3,
    build: () => ({
      risk: 'Coverage assumption is optimistic',
      because: 'High case variability combined with a meaningful exception rate means average-case performance will overstate real coverage.',
      severity: 'moderate',
      mitigation: 'Estimate coverage from a stratified sample of real cases rather than from the typical case, and re-baseline after the pilot.',
    }),
  },
  {
    id: 'unspecified-rules',
    applies: (i, a) => i.structure.ruleClarity <= 2 && a.level >= 2,
    build: (i) => ({
      risk: 'Behaviour cannot be specified',
      because: `Rule clarity is ${i.structure.ruleClarity}/5 — there is no written standard to evaluate the system against.`,
      severity: 'high',
      mitigation: 'Write the decision rules down from a sample of resolved cases first. This is a prerequisite for evaluation, not a documentation exercise.',
    }),
  },
  {
    id: 'latency-pressure',
    applies: (i, a) => i.oversight.approvalLatencyImpact >= 4 && a.level === 3,
    build: () => ({
      risk: 'Pressure to remove the approval gate',
      because: 'Approval latency erases most of the benefit at this level, which creates standing pressure to weaken the control that makes the pattern safe.',
      severity: 'moderate',
      mitigation: 'Treat the gate as fixed and invest in the conditions for bounded execution instead — verification, rollback, and thresholds — rather than relaxing approval under delivery pressure.',
    }),
  },
]

export function computeRisks(input: AssessmentInput, autonomy: AutonomyResult): RiskEntry[] {
  return rules
    .filter((r) => r.applies(input, autonomy))
    .map((r) => ({ id: r.id, ...r.build(input, autonomy) }))
    .toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}
