import type { AssessmentInput } from '../domain/types'
import type { AutonomyResult } from './autonomy'
import type { ReadinessResult } from './readiness'
import type { CapacityEstimate } from './economics'
import type { PatternResult } from './pattern'
import { deriveVolume } from './normalize'

/* ------------------------------------------------------------------ *
 * Next experiment
 * ------------------------------------------------------------------ */

export interface NextExperiment {
  title: string
  rationale: string
  criteria: string[]
}

/**
 * The recommended next step is the cheapest action that would resolve the
 * binding uncertainty — not the first step of the eventual build. Where the
 * binding constraint is missing instrumentation, the experiment is
 * instrumentation, even though that is nobody's favourite answer.
 */
export function computeExperiment(
  input: AssessmentInput,
  autonomy: AutonomyResult,
  readiness: ReadinessResult,
  capacity: CapacityEstimate,
): NextExperiment {
  const { structure: s, systems: sys, oversight: o } = input
  const vol = deriveVolume(input.economics)

  if (autonomy.zeroVariant === 'human-led') {
    return {
      title: 'Write down the decision rules from resolved cases',
      rationale: 'Judgment that cannot be articulated cannot be evaluated, delegated, or trained against. This is the step that makes every later option possible.',
      criteria: [
        'Twenty resolved cases reviewed and their reasoning captured',
        'A written standard two reviewers agree on',
        'Disagreement rate between reviewers measured on a held-out set',
      ],
    }
  }

  if (autonomy.zeroVariant === 'conventional') {
    return {
      title: 'Implement the rules deterministically and measure the residual',
      rationale: 'The specified path is cheap to build and free to trust. What matters is the size of the tail it cannot handle — that residual is the only part where a model could earn its cost.',
      criteria: [
        'Rules implemented and running against live cases',
        'Share of cases the rules complete without hand-off measured',
        'The residual tail characterised by cause, not just counted',
      ],
    }
  }

  if (vol.manualHoursPerYear < 150) {
    return {
      title: 'Confirm the volume before building anything',
      rationale: `At ${Math.round(vol.manualHoursPerYear)} hours a year, the workflow is unlikely to repay a build under any pattern. The question to settle first is whether the stated volume is the whole picture.`,
      criteria: [
        'Actual case volume measured over a representative period',
        'Adjacent workflows checked for the same shape',
        'Decision recorded either way, so this is not reassessed monthly',
      ],
    }
  }

  if (sys.systemAccess <= 2) {
    return {
      title: 'Build read access to the context a case needs',
      rationale: 'Nothing above assist is possible until context can be retrieved programmatically. This is an integration project, and naming it as one avoids months spent on prompts instead.',
      criteria: [
        'The fields a case requires reachable through an interface',
        'Retrieval latency acceptable for the workflow’s tempo',
        'Access scoped to this workflow rather than granted broadly',
      ],
    }
  }

  if (sys.observability <= 2 || o.feedbackAvailability <= 2) {
    return {
      title: 'Instrument the workflow before automating any part of it',
      rationale: 'The current process cannot report its own error rate, so there is no baseline for any system to be measured against. Building first means never being able to prove the result.',
      criteria: [
        'Per-case outcome captured for four weeks',
        'Current error and rework rate established as a baseline',
        'Exception causes categorised, not just counted',
      ],
    }
  }

  if (sys.verification <= 2) {
    return {
      title: 'Establish a deterministic post-condition check',
      rationale: 'Verification is the highest-leverage investment available here: it raises the autonomy ceiling and lowers review cost at the same time.',
      criteria: [
        'A programmatic check covering the majority of cases',
        'Check validated against historical known-good and known-bad cases',
        'False-pass rate measured, not assumed',
      ],
    }
  }

  if (s.ruleClarity <= 2) {
    return {
      title: 'Specify the decision rules from a sample of resolved cases',
      rationale: 'Without a written standard there is nothing to evaluate the system against, and every disagreement becomes a matter of opinion.',
      criteria: [
        'Thirty resolved cases reviewed and their rules extracted',
        'Two reviewers agreeing on the written standard',
        'Ambiguous cases catalogued as the known exception set',
      ],
    }
  }

  if (autonomy.level === 2) {
    return {
      title: 'Prototype a read-only investigator on historical cases',
      rationale: 'Running against closed cases tests context assembly and reasoning quality with no exposure at all, and produces the accuracy baseline a pilot needs.',
      criteria: [
        'Fifty historical cases processed end to end',
        'Recommendation agreement with the recorded human outcome measured',
        'Context assembly succeeding without manual assistance',
        'Zero write calls in the tool allowlist',
      ],
    }
  }

  if (autonomy.level === 3) {
    const share = readiness.level === 'pilot' || readiness.level === 'production-candidate' ? '10%' : '5%'
    return {
      title: `Pilot a supervised agent on ${share} of live cases`,
      rationale: 'The open question is no longer whether the reasoning holds but whether the approval boundary works in practice at real volume and real time pressure.',
      criteria: [
        `${share} of cases routed through the agent for four weeks`,
        'No irreversible action executed without recorded approval',
        'Approval dwell time under five minutes at the median',
        'Full per-case trace available for every pilot case',
        'Human override rate measured and its causes categorised',
      ],
    }
  }

  if (autonomy.level >= 4) {
    return {
      title: 'Run bounded execution against a capped subset',
      rationale: 'Controls exist on paper; the pilot exists to prove the envelope holds under real variance — particularly that breaches escalate rather than proceed.',
      criteria: [
        'Transaction and rate ceilings enforced and observed in the trace',
        'Every envelope breach escalated, none executed',
        'Rollback exercised at least once against a real committed action',
        'Reconciliation sweep finding no unexplained effects',
        `Net capacity within 25% of the projected ${capacity.netCapacityHours.toFixed(0)} hours a week`,
      ],
    }
  }

  return {
    title: 'Trial assisted drafting with the people who do the work',
    rationale: 'At this level the value is in the person’s speed, so the only meaningful test is whether practitioners keep using it once the novelty passes.',
    criteria: [
      'Two weeks of use by the team that owns the workflow',
      'Sustained voluntary use in week two, not just week one',
      'Time per case measured before and after',
    ],
  }
}

/* ------------------------------------------------------------------ *
 * Pilot design
 * ------------------------------------------------------------------ */

export interface PilotPlan {
  objective: string
  scope: string
  users: string
  allowed: string[]
  disallowed: string[]
  approvalBoundary: string
  fallback: string
  logging: string
  duration: string
  exitCriteria: string[]
}

export function computePilot(
  input: AssessmentInput,
  autonomy: AutonomyResult,
  pattern: PatternResult,
  capacity: CapacityEstimate,
): PilotPlan {
  const name = input.definition.name || 'this workflow'
  const perWeek = Math.round(capacity.casesPerWeek)

  // Below supervised there is nothing executing, so the pilot runs against
  // closed cases rather than a share of live traffic.
  const live = autonomy.level >= 3
  const liveShare = 0.1
  const weeklyCases = Math.max(1, Math.round(perWeek * liveShare) || 1)
  const scope = live
    ? `${Math.round(liveShare * 100)}% of live cases${perWeek > 0 ? ` — roughly ${weeklyCases} a week` : ''}, sampled to include the exception mix rather than the easy tail.`
    : 'Fifty closed cases, replayed end to end and sampled to include the exception mix rather than the easy tail.'

  const disallowed = [...pattern.pattern.requiresApproval]
  if (input.risk.reversibility <= 2) disallowed.push('Any action without a rehearsed reversal path')
  if (input.risk.dataSensitivity >= 4) disallowed.push('Retrieval of restricted fields not required by the decision')
  if (input.systems.permissionComplexity >= 4) disallowed.push('Use of shared or broadly scoped credentials')
  if (disallowed.length === 0) disallowed.push('Any change to the rules or envelope during the pilot window')

  return {
    objective: `Establish whether ${pattern.pattern.name.toLowerCase()} handles ${name.toLowerCase()} at the quality the current process achieves, and whether the control boundary holds under real conditions.`,
    scope,
    users:
      input.economics.peopleInvolved && input.economics.peopleInvolved > 1
        ? 'The team that owns the workflow today, with one named approver per shift.'
        : 'The practitioners who own the workflow today, plus one named approver.',
    allowed: pattern.pattern.allowed,
    disallowed,
    approvalBoundary:
      pattern.pattern.requiresApproval.length > 0
        ? pattern.pattern.requiresApproval.join('; ')
        : 'No synchronous approval; breaches of the stated envelope escalate instead.',
    fallback:
      'On any validation failure, timeout, or low-confidence case, the case returns to the manual queue with its partial trace attached. The fallback is the default path, not an error path.',
    logging:
      'Per case: inputs, retrieved context with sources, every tool call and result, the decision, the approver where applicable, and the final outcome.',
    duration: live ? 'Four weeks, or 200 cases, whichever comes first.' : 'Two weeks against closed cases.',
    exitCriteria: buildExitCriteria(input, autonomy),
  }
}

function buildExitCriteria(input: AssessmentInput, autonomy: AutonomyResult): string[] {
  const out: string[] = []
  out.push('Quality at or above the current process baseline on the same case mix')
  if (autonomy.level >= 3) {
    out.push('Zero consequential actions executed outside the approval boundary')
  }
  if (autonomy.level >= 4) {
    out.push('Every envelope breach escalated rather than executed')
    out.push('Rollback exercised successfully against a real committed action')
  }
  out.push('Escalation queue drained within its stated service expectation')
  if (input.oversight.reviewCost >= 3) {
    out.push('Review time per case low enough that the oversight step is not the new bottleneck')
  }
  out.push('Enough cases traced end to end to support an incident review')
  return out
}

/* ------------------------------------------------------------------ *
 * Evaluation metrics
 * ------------------------------------------------------------------ */

export interface EvaluationMetric {
  name: string
  /** Why this workflow in particular needs this metric. */
  why: string
}

/**
 * Metrics are selected, not enumerated. A workflow that cannot escalate does
 * not need a false-escalation rate; one that never writes does not need a
 * rollback rate. Shipping the full list would be easier and less useful.
 */
export function computeEvaluation(input: AssessmentInput, autonomy: AutonomyResult): EvaluationMetric[] {
  const { structure: s, systems: sys, risk: r, oversight: o } = input
  const m: EvaluationMetric[] = []

  m.push({ name: 'Task completion', why: 'The share of cases finished without hand-off is the coverage assumption the capacity model rests on.' })

  if (sys.verification >= 3) {
    m.push({ name: 'Accuracy against the check', why: 'A deterministic check exists here, so correctness can be measured rather than sampled.' })
  } else {
    m.push({ name: 'Expert-adjudicated accuracy', why: 'Without a cheap check, accuracy has to come from a reviewed sample — budget for it rather than assuming it.' })
  }

  if (s.contextBreadth >= 3) {
    m.push({ name: 'Groundedness', why: 'The system assembles context across sources, so claims must be traceable to a retrieved record rather than generated.' })
  }
  if (autonomy.level >= 3) {
    m.push({ name: 'Tool call success rate', why: 'Execution failures are the dominant failure mode once an agent acts, and they are invisible in output quality alone.' })
  }
  if (s.exceptionRate >= 3) {
    m.push({ name: 'Exception recall', why: 'With exceptions this frequent, missing one matters more than handling an ordinary case slightly worse.' })
    m.push({ name: 'Missed escalation rate', why: 'The cases that should have escalated and did not are the ones that become incidents.' })
  }
  if (o.escalationAvailability >= 3 && s.exceptionRate >= 2) {
    m.push({ name: 'False escalation rate', why: 'Over-escalation quietly transfers the workload back to people while appearing safe.' })
  }
  if (autonomy.level === 3) {
    m.push({ name: 'Approval dwell time', why: 'If approval takes longer than doing the work, the pattern has moved the bottleneck rather than removed it.' })
    m.push({ name: 'Override rate', why: 'A high override rate means the approval gate is doing real work — and that autonomy should not rise yet.' })
  }
  if (autonomy.level >= 4 && r.reversibility <= 4) {
    m.push({ name: 'Rollback rate', why: 'Independent execution makes reversal a routine operation whose frequency is a health signal.' })
  }
  if (o.reviewCost >= 3) {
    m.push({ name: 'Human review time', why: 'Review cost is high enough here that oversight effort has to be tracked as a cost, not assumed away.' })
  }
  if (o.approvalLatencyImpact >= 4) {
    m.push({ name: 'End-to-end latency', why: 'The workflow is time-sensitive, so a correct answer delivered late is a different failure.' })
  }
  if (r.blastRadius >= 4) {
    m.push({ name: 'Reconciliation breaks', why: 'A wide radius means some errors are only visible in aggregate state, not per case.' })
  }
  m.push({ name: 'Cost per case', why: 'Compared against the manual cost per case, this is what makes the capacity claim falsifiable.' })

  return m
}
