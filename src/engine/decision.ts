import type { Assessment, Decision, DecisionStatus } from '../domain/types'
import { DIMENSION_BY_KEY, readDimension } from '../domain/dimensions'
import type { AssessmentResult } from './assess'
import { AUTONOMY_BY_LEVEL, gateActive, GATES, unmetRequirements, type AutonomyLevel } from './autonomy'

/**
 * Reading a recorded decision against the recommendation.
 *
 * The model does not object when a team lands somewhere else — it is a decision
 * instrument, not an approver. What it can usefully do is name precisely which
 * conditions a more autonomous choice is being made against, so that the
 * divergence is recorded as an accepted risk rather than an oversight. That is
 * the difference between a team that disagreed with the model and one that
 * never read it.
 */

export type Divergence = 'none' | 'above' | 'below'

/**
 * *Why* a more autonomous choice diverges, which is not always the same reason.
 *
 * A level-0 recommendation may come from the gates (nothing is safe enough) or
 * from the work not needing a model at all. In the second case the gates can
 * happily permit bounded execution, and telling the team they are exceeding
 * what the model permits would be false — what they are actually accepting is
 * the cost of a system the work does not require.
 */
export type DivergenceKind = 'gated' | 'unnecessary' | 'judgment' | 'conservative' | 'none'

export interface AcceptedCondition {
  gateId: string
  title: string
  detail: string
  /** The unmet requirements, in the user's vocabulary. */
  unmet: { label: string; from: number; to: number; op: '>=' | '<=' }[]
}

export interface DecisionReview {
  status: DecisionStatus
  /** The level actually chosen, falling back to the recommendation. */
  effectiveLevel: AutonomyLevel
  recommendedLevel: AutonomyLevel
  divergence: Divergence
  /** Why it diverges — the gates, or something else entirely. */
  divergenceKind: DivergenceKind
  /** Gates the chosen level does not clear. Empty unless gates are the reason. */
  accepted: AcceptedCondition[]
  /** Whether the record is complete enough to stand as a decision. */
  complete: boolean
  missing: string[]
  headline: string
  note: string
}

export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  undecided: 'Not decided',
  proceeding: 'Proceeding',
  deferred: 'Deferred',
  declined: 'Declined',
}

export function reviewDecision(assessment: Assessment, result: AssessmentResult): DecisionReview {
  const decision: Decision = assessment.decision
  const recommendedLevel = result.autonomy.level
  const effectiveLevel = (decision.chosenLevel ?? recommendedLevel) as AutonomyLevel

  const divergence: Divergence =
    decision.status === 'undecided' || decision.chosenLevel === null
      ? 'none'
      : effectiveLevel > recommendedLevel
        ? 'above'
        : effectiveLevel < recommendedLevel
          ? 'below'
          : 'none'

  // Every gate that caps below the chosen level is a condition the team is
  // proceeding without. Naming them turns a divergence into an accepted risk.
  // Several gates can rest on the same unmet value. Each gate is a distinct
  // reason and worth listing, but repeating "reversibility 2 → 3" under three
  // of them reads as three problems when it is one.
  const seenRequirement = new Set<string>()
  const accepted: AcceptedCondition[] =
    divergence === 'above'
      ? GATES.filter((gate) => gate.cap < effectiveLevel && gateActive(assessment.input, gate)).map(
          (gate) => ({
            gateId: gate.id,
            title: gate.title,
            detail: gate.detail,
            unmet: unmetRequirements(assessment.input, gate)
              .filter((r) => {
                const id = `${r.key}${r.op}${r.value}`
                if (seenRequirement.has(id)) return false
                seenRequirement.add(id)
                return true
              })
              .map((r) => ({
                label: DIMENSION_BY_KEY[r.key].label,
                from: readDimension(assessment.input, r.key),
                to: r.value,
                op: r.op,
              })),
          }),
        )
      : []

  const zeroVariant = result.autonomy.zeroVariant
  const divergenceKind: DivergenceKind =
    divergence === 'below'
      ? 'conservative'
      : divergence === 'none'
        ? 'none'
        : zeroVariant === 'conventional'
          ? 'unnecessary'
          : zeroVariant === 'human-led'
            ? 'judgment'
            : 'gated'

  const missing: string[] = []
  if (decision.status !== 'undecided') {
    if (!decision.owner.trim()) missing.push('an accountable owner')
    if (!decision.rationale.trim()) missing.push('the reasoning')
  }

  return {
    status: decision.status,
    effectiveLevel,
    recommendedLevel,
    divergence,
    accepted,
    complete: decision.status !== 'undecided' && missing.length === 0,
    missing,
    divergenceKind,
    headline: headlineFor(decision.status, divergence, effectiveLevel, recommendedLevel, result),
    note: noteFor(decision.status, divergenceKind, accepted.length, effectiveLevel, result),
  }
}

function headlineFor(
  status: DecisionStatus,
  divergence: Divergence,
  chosen: AutonomyLevel,
  recommended: AutonomyLevel,
  result: AssessmentResult,
): string {
  if (status === 'undecided') return 'No decision recorded'
  if (status === 'deferred') return 'Deferred'
  if (status === 'declined') return 'Declined'
  if (divergence === 'none') return `Proceeding at ${AUTONOMY_BY_LEVEL[chosen].name.toLowerCase()}`
  // Use the recommendation's own display name: at level 0 the ladder's generic
  // label says "conventional / human-led" when only one of those applies.
  const recommendedName =
    recommended === result.autonomy.level
      ? result.autonomy.displayName.toLowerCase()
      : AUTONOMY_BY_LEVEL[recommended].name.toLowerCase()
  return `Proceeding at ${AUTONOMY_BY_LEVEL[chosen].name.toLowerCase()}, ${divergence} the recommended ${recommendedName}`
}

function noteFor(
  status: DecisionStatus,
  kind: DivergenceKind,
  acceptedCount: number,
  chosen: AutonomyLevel,
  result: AssessmentResult,
): string {
  if (status === 'undecided') {
    return 'The recommendation stands on its own until someone records what was decided. A recommendation is not a decision, and this assessment does not yet say who chose what.'
  }
  if (status === 'deferred') {
    return 'Deferred rather than declined. Worth recording what would need to change, and when this should be looked at again — otherwise a deferral is indistinguishable from being forgotten.'
  }
  if (status === 'declined') {
    return 'Declined. The assessment remains a record of why, which is more useful six months from now than the absence of one.'
  }
  if (kind === 'gated') {
    return `This proceeds at a higher autonomy level than the gates permit. ${acceptedCount} ${acceptedCount === 1 ? 'condition is' : 'conditions are'} unmet at ${AUTONOMY_BY_LEVEL[chosen].name.toLowerCase()}; they are listed alongside so the divergence is on the record as an accepted risk rather than an oversight.`
  }
  if (kind === 'unnecessary') {
    return `The gates permit this level — the controls are not the objection. Deterministic automation was recommended because the work is specified well enough that a model adds nothing, so what is being accepted here is the cost of building and evaluating a system the workflow may not need.`
  }
  if (kind === 'judgment') {
    return `The recommendation was to keep the work with people because expert judgment is the deliverable and correctness is expensive to establish. Proceeding means accepting that the system will be making calls no one can cheaply check.`
  }
  if (kind === 'conservative') {
    return `This proceeds more conservatively than the model permits. Nothing objects — the gates set a ceiling, not a target — but it is worth recording why the headroom is not being used, since ${result.autonomy.displayName.toLowerCase()} was available.`
  }
  return 'Proceeding at the recommended level, with the reasoning on the record.'
}
