import type { AssessmentInput } from '../domain/types'
import type { AutonomyResult } from './autonomy'
import type { ControlPosture } from './controls'
import type { CapacityEstimate } from './economics'
import type { PatternId, PatternResult } from './pattern'

/**
 * What building this would cost, and whether it repays.
 *
 * A recommendation to build is not a recommendation until it names a price.
 * This module estimates implementation effort from the pattern and the gaps the
 * assessment already measured — the same gaps that hold autonomy down are the
 * ones that cost engineering weeks to close — and turns that into a return the
 * user can argue with.
 *
 * The estimate is a range, always. Effort estimates that read as point values
 * invite a precision this model does not have.
 */

export interface EffortDriver {
  label: string
  weeks: number
  /** Why this workflow incurs it. */
  because: string
}

export type InvestmentVerdict = 'strong' | 'plausible' | 'marginal' | 'unfavourable' | 'no-build'

export interface InvestmentEstimate {
  /** Engineer-weeks to a running pilot. Skewed right, as estimates are. */
  effortWeeks: { low: number; mid: number; high: number }
  drivers: EffortDriver[]
  /** Ongoing engineer-weeks per year to keep it working. */
  maintenanceWeeksPerYear: number
  /**
   * Annual capacity hours returned per engineer-week of build. Currency-free,
   * so it works for the majority of assessments that carry no cost figures.
   */
  returnRatio: number | null
  /** Build cost, when an engineering weekly cost was supplied. */
  buildCost: number | null
  /**
   * Months for net annual value to repay the build. Null both when cost data is
   * missing and when the build is never repaid — `repaysFromCapacity`
   * distinguishes the two, because "we cannot tell" and "it does not" are very
   * different answers.
   */
  paybackMonths: number | null
  /** False only when cost figures exist and upkeep outruns the value returned. */
  repaysFromCapacity: boolean
  verdict: InvestmentVerdict
  headline: string
  note: string
}

/**
 * Baseline effort by pattern, in engineer-weeks, assuming the surrounding
 * systems are already in good shape. Gap costs are added separately, so these
 * describe the pattern itself and nothing else.
 */
const PATTERN_BASE: Record<PatternId, number> = {
  'human-led': 0,
  'traditional-automation': 3,
  'ai-assist': 2,
  'retrieval-assist': 5,
  'read-only-tool-agent': 6,
  'assistive-tool-agent': 8,
  'supervised-tool-agent': 12,
  'bounded-execution-agent': 18,
}

/**
 * Controls each level normally implies, already priced into `PATTERN_BASE`.
 * Only controls beyond this — the ones this workflow's own risk profile added —
 * cost extra, otherwise a bounded agent would be charged twice for the rollback
 * and reconciliation its baseline already assumes.
 */
const CONTROL_BASELINE: Record<number, number> = { 0: 2, 1: 2, 2: 4, 3: 9, 4: 15, 5: 16 }

const round = (n: number): number => (n < 10 ? Math.round(n * 2) / 2 : Math.round(n))

export function computeInvestment(
  input: AssessmentInput,
  autonomy: AutonomyResult,
  pattern: PatternResult,
  controls: ControlPosture,
  capacity: CapacityEstimate,
): InvestmentEstimate {
  const { structure: s, systems: sys, risk: r } = input
  const base = PATTERN_BASE[pattern.pattern.id]
  const drivers: EffortDriver[] = []

  if (base > 0) {
    drivers.push({
      label: pattern.pattern.name,
      weeks: base,
      because: 'Baseline for the recommended pattern, assuming the systems around it are ready.',
    })
  }

  // Reading the case at all. Every pattern above human-led needs this.
  if (base > 0 && sys.systemAccess < 4) {
    drivers.push({
      label: 'Integration',
      weeks: (4 - sys.systemAccess) * 4,
      because: `System access is ${sys.systemAccess}/5 — the context has to be made reachable before anything can read it.`,
    })
  }

  // Acting through interfaces. Only patterns that write or stage need this.
  const writes = autonomy.level >= 2 || pattern.pattern.id === 'traditional-automation'
  if (writes && sys.toolingReadiness < 4) {
    drivers.push({
      label: 'Typed tool surface',
      weeks: (4 - sys.toolingReadiness) * 3,
      because: `Tooling readiness is ${sys.toolingReadiness}/5 — actions need explicit contracts before they can be bounded.`,
    })
  }

  if (base > 0 && sys.observability < 3) {
    drivers.push({
      label: 'Instrumentation',
      weeks: (3 - sys.observability) * 2.5,
      because: `Observability is ${sys.observability}/5 — a per-case trace has to exist before anything can be evaluated.`,
    })
  }

  if (base > 0 && sys.verification < 3) {
    drivers.push({
      label: 'Verification',
      weeks: (3 - sys.verification) * 2.5,
      because: `Verification is ${sys.verification}/5 — a correctness check has to be built, not assumed.`,
    })
  }

  if (base > 0 && sys.permissionComplexity >= 4) {
    drivers.push({
      label: 'Permission scoping',
      weeks: 2,
      because: `Permission complexity is ${sys.permissionComplexity}/5 — narrow credentials have to be provisioned and maintained.`,
    })
  }

  if (base > 0 && r.regulatorySensitivity >= 4) {
    drivers.push({
      label: 'Compliance review',
      weeks: 3,
      because: `Regulatory sensitivity is ${r.regulatorySensitivity}/5 — the control design has to be reviewed and evidenced.`,
    })
  }

  if (base > 0 && r.dataSensitivity >= 4) {
    drivers.push({
      label: 'Data handling',
      weeks: 2,
      because: `Data sensitivity is ${r.dataSensitivity}/5 — retrieval has to be restricted and retention bounded.`,
    })
  }

  const expectedControls = CONTROL_BASELINE[autonomy.level] ?? 4
  const extraControls = Math.max(0, controls.required.length - expectedControls)
  if (extraControls > 0) {
    drivers.push({
      label: 'Additional controls',
      weeks: extraControls * 0.6,
      because: `${controls.required.length} controls are required here, ${extraControls} more than this pattern normally carries.`,
    })
  }

  if (base > 0 && s.exceptionRate >= 4) {
    drivers.push({
      label: 'Exception path',
      weeks: 2,
      because: `Exception rate is ${s.exceptionRate}/5 — the escalation path carries enough volume to need real design.`,
    })
  }

  const mid = drivers.reduce((sum, d) => sum + d.weeks, 0)
  const effortWeeks = {
    low: round(mid * 0.7),
    mid: round(mid),
    high: round(mid * 1.6),
  }

  const maintenanceWeeksPerYear = mid > 0 ? round(Math.max(0.5, mid * 0.12)) : 0

  const annualHours = capacity.annual.netCapacityHours
  const returnRatio = mid > 0 && annualHours > 0 ? annualHours / mid : null

  const weeklyCost = input.economics.engineeringWeeklyCost
  const buildCost = weeklyCost !== null && weeklyCost > 0 && mid > 0 ? mid * weeklyCost : null

  const annualValue = capacity.annual.capacityValue
  const costKnown = buildCost !== null && annualValue !== null && weeklyCost !== null

  let paybackMonths: number | null = null
  let repaysFromCapacity = true
  if (costKnown) {
    const netAnnual = annualValue - maintenanceWeeksPerYear * weeklyCost
    if (netAnnual > 0) paybackMonths = (buildCost / netAnnual) * 12
    else repaysFromCapacity = false
  }

  const verdict = judge({ mid, costKnown, repaysFromCapacity, paybackMonths, returnRatio, autonomy })

  return {
    effortWeeks,
    drivers,
    maintenanceWeeksPerYear,
    returnRatio,
    buildCost,
    paybackMonths,
    repaysFromCapacity,
    verdict,
    headline: headlineFor(verdict, effortWeeks, paybackMonths, returnRatio, repaysFromCapacity),
    note: noteFor(verdict, autonomy, maintenanceWeeksPerYear),
  }
}

/**
 * Payback where money is known, capacity-per-week where it is not. Thresholds
 * are deliberately unforgiving: an internal build competing for the same
 * engineers as everything else should clear a real bar, not a nominal one.
 */
function judge(args: {
  mid: number
  costKnown: boolean
  repaysFromCapacity: boolean
  paybackMonths: number | null
  returnRatio: number | null
  autonomy: AutonomyResult
}): InvestmentVerdict {
  const { mid, costKnown, repaysFromCapacity, paybackMonths, returnRatio, autonomy } = args
  if (mid <= 0 || autonomy.zeroVariant === 'human-led') return 'no-build'

  // Where the money is known, it settles the question. Falling back to the
  // currency-free ratio here would quietly overrule a figure the user supplied.
  if (costKnown) {
    if (!repaysFromCapacity || paybackMonths === null) return 'unfavourable'
    if (paybackMonths <= 9) return 'strong'
    if (paybackMonths <= 18) return 'plausible'
    if (paybackMonths <= 36) return 'marginal'
    return 'unfavourable'
  }

  if (returnRatio === null) return 'unfavourable'
  if (returnRatio >= 120) return 'strong'
  if (returnRatio >= 50) return 'plausible'
  if (returnRatio >= 20) return 'marginal'
  return 'unfavourable'
}

const fmtWeeks = (n: number): string => (n < 10 ? n.toFixed(n % 1 === 0 ? 0 : 1) : String(Math.round(n)))

function headlineFor(
  verdict: InvestmentVerdict,
  effort: InvestmentEstimate['effortWeeks'],
  paybackMonths: number | null,
  returnRatio: number | null,
  repaysFromCapacity: boolean,
): string {
  if (verdict === 'no-build') return 'No build to fund'
  const range = `${fmtWeeks(effort.low)}–${fmtWeeks(effort.high)} engineer-weeks`
  if (!repaysFromCapacity) {
    return `${range}, never repaid — upkeep alone outruns the value returned`
  }
  if (paybackMonths !== null) {
    return `${range}, repaying in about ${Math.round(paybackMonths)} month${Math.round(paybackMonths) === 1 ? '' : 's'}`
  }
  if (returnRatio !== null) {
    return `${range}, returning about ${Math.round(returnRatio)} hours a year per week invested`
  }
  return `${range}, with no measurable capacity return`
}

function noteFor(
  verdict: InvestmentVerdict,
  autonomy: AutonomyResult,
  maintenance: number,
): string {
  if (verdict === 'no-build') {
    return autonomy.zeroVariant === 'human-led'
      ? 'The recommendation is to keep the work with people, so there is nothing to cost. The investment worth making is in written decision rules and outcome capture.'
      : 'No implementation effort is implied at this level.'
  }

  const upkeep = `Budget roughly ${fmtWeeks(maintenance)} engineer-weeks a year of upkeep on top: interfaces drift, and an unmaintained agent degrades quietly.`

  switch (verdict) {
    case 'strong':
      return `The return clears the bar comfortably. ${upkeep}`
    case 'plausible':
      return `The return is real but not overwhelming — worth funding if this workflow is a priority, and worth deferring if something else returns faster. ${upkeep}`
    case 'marginal':
      return `The return is thin against the effort. Narrow the scope to the highest-volume slice, or fund the prerequisites on their own merits first. If the real case rests on something this model does not price — latency, consistency, or coverage the current process cannot reach — say so explicitly rather than leaning on the capacity figure. ${upkeep}`
    default:
      return `The effort is not repaid by the capacity it returns under these assumptions. That is not the same as saying do not build it: this model prices returned hours and nothing else. If the case rests on latency, consistency, auditability, or coverage the current process cannot reach, state that as the justification instead. ${upkeep}`
  }
}

export const INVESTMENT_VERDICT_LABEL: Record<InvestmentVerdict, string> = {
  strong: 'Strong return',
  plausible: 'Plausible return',
  marginal: 'Marginal return',
  unfavourable: 'Not repaid by capacity',
  'no-build': 'No build',
}
