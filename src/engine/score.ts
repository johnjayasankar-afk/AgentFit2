import {
  CONTROL_WEIGHTS,
  ECONOMIC_REFS,
  ECONOMIC_WEIGHTS,
  RISK_WEIGHTS,
  SCORE_WEIGHTS,
  STRUCTURE_WEIGHTS,
  TECHNICAL_WEIGHTS,
  clamp,
  clampScore,
  scaleToUnit,
} from "@/domain/model";
import type { AssessmentInputs, ScoreBreakdown } from "@/domain/types";
import { unit01, weeklyCases, weeklyManualHours } from "./normalize";

/**
 * Agent Fit measures opportunity and suitability for an *agentic* implementation.
 * It is not an autonomy recommendation. High fit + high consequence still
 * produces a supervised (or lower) autonomy posture.
 */
export function scoreFit(inputs: AssessmentInputs): ScoreBreakdown {
  const economicOpportunity = scoreEconomic(inputs);
  const workflowStructure = scoreStructure(inputs);
  const technicalReadiness = scoreTechnical(inputs);
  const controllability = scoreControllability(inputs);
  const riskSuitability = scoreRisk(inputs);
  const humanJudgmentSuitability = scoreJudgment(inputs);
  const affinity = conventionalAffinity(inputs);
  const conventionalPenalty = affinity > 0.78 ? Math.round((affinity - 0.78) * 40) : 0;

  const raw =
    economicOpportunity +
    workflowStructure +
    technicalReadiness +
    controllability +
    riskSuitability +
    humanJudgmentSuitability -
    conventionalPenalty;

  return {
    economicOpportunity: round1(economicOpportunity),
    workflowStructure: round1(workflowStructure),
    technicalReadiness: round1(technicalReadiness),
    controllability: round1(controllability),
    riskSuitability: round1(riskSuitability),
    humanJudgmentSuitability: round1(humanJudgmentSuitability),
    conventionalPenalty,
    total: clampScore(raw),
  };
}

export function scoreEconomic(inputs: AssessmentInputs): number {
  const cases = weeklyCases(inputs.economics);
  const hours = weeklyManualHours(inputs.economics);
  const volume = unit01(cases, ECONOMIC_REFS.weeklyCasesCap);
  const time = unit01(inputs.economics.minutesPerCase, ECONOMIC_REFS.minutesCap);
  const hourShare = unit01(hours, ECONOMIC_REFS.weeklyHoursCap);
  const variabilityDrag = scaleToUnit(inputs.economics.variability) * ECONOMIC_REFS.variabilityDrag;
  const mix =
    ECONOMIC_WEIGHTS.volume * volume +
    ECONOMIC_WEIGHTS.timePerCase * time +
    ECONOMIC_WEIGHTS.weeklyHours * hourShare;
  return SCORE_WEIGHTS.economicOpportunity * mix * (1 - variabilityDrag);
}

export function scoreStructure(inputs: AssessmentInputs): number {
  const mix =
    STRUCTURE_WEIGHTS.ruleClarity * scaleToUnit(inputs.structure.ruleClarity) +
    STRUCTURE_WEIGHTS.inputStructure * scaleToUnit(inputs.structure.inputStructure) +
    STRUCTURE_WEIGHTS.exceptionBurden * (1 - scaleToUnit(inputs.structure.exceptionRate));
  return SCORE_WEIGHTS.workflowStructure * mix;
}

export function scoreTechnical(inputs: AssessmentInputs): number {
  const access = scaleToUnit(inputs.systems.systemAccess);
  const tools = scaleToUnit(inputs.systems.toolingReadiness);
  const context = scaleToUnit(inputs.structure.contextBreadth);
  // Agents earn more when context is real *and* reachable. Isolated local
  // context is closer to a script; unreachable breadth is just a gap.
  const contextContribution = context * (0.35 + 0.65 * access);
  const obs = scaleToUnit(inputs.systems.observability);
  const mix =
    TECHNICAL_WEIGHTS.systemAccess * access +
    TECHNICAL_WEIGHTS.toolingReadiness * tools +
    TECHNICAL_WEIGHTS.context * contextContribution +
    TECHNICAL_WEIGHTS.observability * obs;
  return SCORE_WEIGHTS.technicalReadiness * mix;
}

export function scoreControllability(inputs: AssessmentInputs): number {
  const mix =
    CONTROL_WEIGHTS.reversibility * scaleToUnit(inputs.risk.reversibility) +
    CONTROL_WEIGHTS.verification * scaleToUnit(inputs.systems.verification) +
    CONTROL_WEIGHTS.feedback * scaleToUnit(inputs.humanLoop.feedbackAvailability) +
    CONTROL_WEIGHTS.escalation * scaleToUnit(inputs.humanLoop.escalationAvailability);
  return SCORE_WEIGHTS.controllability * mix;
}

export function scoreRisk(inputs: AssessmentInputs): number {
  const mix =
    RISK_WEIGHTS.failureConsequence * (1 - scaleToUnit(inputs.risk.failureConsequence)) +
    RISK_WEIGHTS.blastRadius * (1 - scaleToUnit(inputs.risk.blastRadius)) +
    RISK_WEIGHTS.regulatorySensitivity * (1 - scaleToUnit(inputs.risk.regulatorySensitivity)) +
    RISK_WEIGHTS.permissionComplexity * (1 - scaleToUnit(inputs.systems.permissionComplexity));
  // High consequence should not erase economic/technical opportunity.
  // Autonomy, not Fit, is where consequence caps independence.
  return SCORE_WEIGHTS.riskSuitability * (0.28 + 0.72 * mix);
}

/**
 * Moderate structured judgment is a strong agent candidate.
 * Irreducible expert judgment is a penalty. Purely mechanical work
 * is slightly less "agentic" than judgment-with-structure.
 */
export function scoreJudgment(inputs: AssessmentInputs): number {
  const j = scaleToUnit(inputs.risk.humanJudgment);
  let shape: number;
  if (j <= 0.25) shape = 0.72 + j * 1.1;
  else if (j <= 0.5) shape = 1;
  else if (j <= 0.75) shape = 1 - (j - 0.5) * 1.4;
  else shape = 0.65 - (j - 0.75) * 1.8;
  return SCORE_WEIGHTS.humanJudgmentSuitability * clamp(shape);
}

/**
 * High affinity means a rules engine / script is likely the better product.
 * Used by the pattern engine and as a modest Agent Fit penalty.
 */
export function conventionalAffinity(inputs: AssessmentInputs): number {
  const rules = scaleToUnit(inputs.structure.ruleClarity);
  const structure = scaleToUnit(inputs.structure.inputStructure);
  const exceptions = 1 - scaleToUnit(inputs.structure.exceptionRate);
  const judgment = 1 - scaleToUnit(inputs.risk.humanJudgment);
  const context = 1 - scaleToUnit(inputs.structure.contextBreadth);
  return clamp(rules * 0.28 + structure * 0.24 + exceptions * 0.18 + judgment * 0.18 + context * 0.12);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
