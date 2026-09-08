import type { AssessmentInput } from '../domain/types'
import { PERIOD_LABEL } from '../domain/types'
import { deriveVolume } from './normalize'
import type { FitResult } from './fit'
import type { AutonomyResult } from './autonomy'
import type { CapacityEstimate } from './economics'
import type { PatternResult } from './pattern'

export interface Explanation {
  strong: string[]
  limiting: string[]
  /** The single paragraph that ties the recommendation together. */
  therefore: string
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US')

/**
 * Reasons are read straight off the inputs and the binding gates, so the
 * explanation cannot drift from the arithmetic that produced the
 * recommendation. Signals are capped at five a side: a list of fifteen
 * observations is not an explanation.
 */
export function computeExplanation(
  input: AssessmentInput,
  fit: FitResult,
  autonomy: AutonomyResult,
  capacity: CapacityEstimate,
  pattern: PatternResult,
): Explanation {
  const { economics: e, structure: s, systems: sys, risk: r, oversight: o } = input
  const vol = deriveVolume(e)

  const strong: string[] = []
  const limiting: string[] = []

  /* --- economics -------------------------------------------------- */
  if (vol.manualHoursPerYear >= 600) {
    strong.push(`${fmt(e.volume)} cases ${PERIOD_LABEL[e.period]} at ${fmt(e.minutesPerCase)} minutes — ${fmt(vol.manualHoursPerYear)} hours a year`)
  } else if (vol.manualHoursPerYear < 150) {
    limiting.push(`Only ${fmt(vol.manualHoursPerYear)} hours a year at stake — thin against any build cost`)
  }
  if (e.variability >= 4) limiting.push('Cases vary enough that average effort understates the hard ones')

  /* --- structure -------------------------------------------------- */
  if (s.ruleClarity >= 4) strong.push('Operating rules are explicit enough to specify and test')
  if (s.ruleClarity <= 2) limiting.push('Correct behaviour is not written down anywhere')
  if (s.inputStructure <= 2) strong.push('Unstructured input — the part of the work a model is genuinely good at')
  if (s.exceptionRate >= 4) limiting.push('Exceptions are frequent enough to dominate the economics')
  if (s.humanJudgment >= 4) limiting.push('Expert judgment remains central to the decision')
  if (fit.detail.aiNecessity <= 0.12) {
    limiting.push('Inputs and rules are deterministic enough that a model may add nothing')
  }

  /* --- systems ---------------------------------------------------- */
  if (sys.systemAccess >= 4) strong.push('Reliable programmatic access to the context a case needs')
  if (sys.systemAccess <= 2) limiting.push('Context cannot be retrieved by software today')
  if (sys.toolingReadiness >= 4) strong.push('Actions already exist as stable, typed interfaces')
  if (sys.toolingReadiness <= 2) limiting.push('No stable interface to act through')
  if (sys.verification >= 4) strong.push('Correctness can be checked cheaply, without a person reading the case')
  if (sys.verification <= 2) limiting.push('Correctness is expensive to establish')
  if (sys.observability >= 4) strong.push('Per-case traceability already exists')
  if (sys.observability <= 2) limiting.push('What the system did would be hard to reconstruct')
  if (sys.permissionComplexity >= 4) limiting.push('Access required is privileged and hard to scope tightly')

  /* --- risk -------------------------------------------------------- */
  if (r.reversibility >= 4) strong.push('Actions are cheap to undo')
  if (r.reversibility <= 2) limiting.push('Actions are hard or impossible to reverse')
  if (r.failureConsequence >= 4) limiting.push('A single uncaught error carries serious consequence')
  if (r.failureConsequence <= 2 && r.blastRadius <= 2) strong.push('A mistake is cheap and stays contained')
  if (r.blastRadius >= 4) limiting.push('One failure propagates well beyond a single record')
  if (r.regulatorySensitivity >= 4) limiting.push('Policy or regulation requires a named accountable human')

  /* --- oversight ---------------------------------------------------- */
  if (o.reviewCost >= 4) limiting.push('Reviewing a case costs nearly as much as doing it')
  if (o.escalationAvailability <= 2) limiting.push('No reliable path for exceptions to reach a person')
  if (o.feedbackAvailability >= 4) strong.push('Outcomes are captured per case, so performance is measurable')
  if (o.feedbackAvailability <= 2) limiting.push('Outcomes are not observed, so nothing can be proven over time')
  if (o.approvalLatencyImpact >= 4 && autonomy.level <= 3) {
    limiting.push('Approval latency would erode much of the benefit at this level')
  }

  return {
    strong: strong.slice(0, 5),
    limiting: limiting.slice(0, 5),
    therefore: composeTherefore(autonomy, capacity, pattern),
  }
}

function composeTherefore(
  autonomy: AutonomyResult,
  capacity: CapacityEstimate,
  pattern: PatternResult,
): string {
  const binding = autonomy.bindingGates[0]
  const hours = capacity.netCapacityHours

  if (autonomy.level === 0 && autonomy.zeroVariant === 'conventional') {
    return 'The rules are explicit, the inputs are structured, and the exception tail is thin. Deterministic automation will be cheaper to build, cheaper to run, and easier to certify than an agent — and it will not require an evaluation programme to trust.'
  }
  if (autonomy.level === 0 && autonomy.zeroVariant === 'human-led') {
    return 'Expert judgment is the deliverable here, and correctness cannot be established cheaply enough for anyone — system or reviewer — to catch a wrong answer. The useful investment is in instrumentation and written decision rules, not in delegation.'
  }

  const value = hours > 1
    ? `The pattern is worth roughly ${hours.toFixed(hours < 10 ? 1 : 0)} hours a week of returned capacity under the stated assumptions`
    : 'The capacity case is thin under the stated assumptions'

  if (autonomy.readinessBinds) {
    return `${value}. Autonomy is held at ${autonomy.meta.name.toLowerCase()} by the overall state of structure, access, and controls rather than by any single hard constraint — the workflow is not yet described or instrumented well enough to delegate further.`
  }

  if (!binding) {
    return `${value}. No gate is currently binding, so the recommendation reflects the readiness the workflow already has.`
  }

  const lead = `${binding.title.charAt(0).toLowerCase()}${binding.title.slice(1)}`
  return `${value}. ${capitalise(pattern.pattern.name)} captures most of that while holding the line where it matters: ${lead}, and ${binding.detail.charAt(0).toLowerCase()}${binding.detail.slice(1)} Raising autonomy above this without clearing that condition would be trading a real control for a projected gain.`
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
