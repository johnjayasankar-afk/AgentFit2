import { scaleToUnit } from "@/domain/model";
import type { AssessmentInputs, AutonomyLabel, AutonomyLevel } from "@/domain/types";
import { conventionalAffinity } from "./score";

export const AUTONOMY_LABELS: Record<AutonomyLevel, AutonomyLabel> = {
  0: "Conventional Software",
  1: "Copilot",
  2: "Assistive Agent",
  3: "Supervised Agent",
  4: "Bounded Agent",
  5: "Autonomous System",
};

/**
 * Autonomy is a product decision, not a model-size decision.
 * This function is intentionally conservative: most enterprise
 * workflows should land at Copilot, Assistive, or Supervised.
 */
export function recommendAutonomy(inputs: AssessmentInputs): AutonomyLevel {
  if (isConventionalSoftware(inputs)) return 0;
  if (isHumanLedCeiling(inputs)) return Math.min(2, maxSafeLevel(inputs)) as AutonomyLevel;

  const ceiling = maxSafeLevel(inputs);
  const unlocked = highestUnlocked(inputs);
  return Math.min(ceiling, unlocked) as AutonomyLevel;
}

export function autonomyLabel(level: AutonomyLevel): AutonomyLabel {
  return AUTONOMY_LABELS[level];
}

export function isConventionalSoftware(inputs: AssessmentInputs): boolean {
  const affinity = conventionalAffinity(inputs);
  return (
    affinity >= 0.82 &&
    inputs.structure.ruleClarity >= 4 &&
    inputs.structure.inputStructure >= 4 &&
    inputs.risk.humanJudgment <= 2 &&
    inputs.structure.exceptionRate <= 2 &&
    inputs.structure.contextBreadth <= 2
  );
}

export function isHumanLedCeiling(inputs: AssessmentInputs): boolean {
  return (
    inputs.risk.humanJudgment >= 4 &&
    inputs.structure.ruleClarity <= 2 &&
    (inputs.risk.failureConsequence >= 4 || inputs.risk.regulatorySensitivity >= 4)
  );
}

function maxSafeLevel(inputs: AssessmentInputs): AutonomyLevel {
  const r = inputs.risk;
  const s = inputs.systems;
  const h = inputs.humanLoop;
  const st = inputs.structure;

  const irreversible = r.reversibility <= 2;
  const severe = r.failureConsequence >= 4;
  const systemic = r.blastRadius >= 4;
  const privileged = s.permissionComplexity >= 4;
  const regulated = r.regulatorySensitivity >= 4;
  const unverified = s.verification <= 2;
  const opaque = s.observability <= 2;
  const noEscalation = h.escalationAvailability <= 2;
  const expert = r.humanJudgment >= 4;
  const messy = st.exceptionRate >= 4;
  const weakAccess = s.systemAccess <= 2 || s.toolingReadiness <= 2;

  if (severe && irreversible && unverified) return 1;
  if (expert && (severe || regulated) && inputs.structure.ruleClarity <= 2) return 2;
  if (weakAccess) return 2;
  if (regulated && unverified) return 2;
  if (privileged && irreversible && unverified) return 2;
  if (severe || systemic || regulated || irreversible) return 3;
  if (irreversible || privileged || noEscalation || opaque) return 3;
  if (unverified || messy || expert) return 3;
  return 5;
}

function highestUnlocked(inputs: AssessmentInputs): AutonomyLevel {
  if (meetsAutonomous(inputs)) return 5;
  if (meetsBounded(inputs)) return 4;
  if (meetsSupervised(inputs)) return 3;
  if (meetsAssistive(inputs)) return 2;
  return 1;
}

function meetsAssistive(inputs: AssessmentInputs): boolean {
  return (
    inputs.structure.ruleClarity >= 2 &&
    (inputs.systems.systemAccess >= 2 || inputs.structure.inputStructure >= 3)
  );
}

function meetsSupervised(inputs: AssessmentInputs): boolean {
  return (
    inputs.systems.systemAccess >= 3 &&
    inputs.systems.toolingReadiness >= 3 &&
    inputs.structure.ruleClarity >= 3 &&
    inputs.risk.humanJudgment <= 4 &&
    (inputs.systems.verification >= 3 || inputs.risk.reversibility >= 3) &&
    inputs.humanLoop.escalationAvailability >= 2
  );
}

function meetsBounded(inputs: AssessmentInputs): boolean {
  return (
    inputs.risk.reversibility >= 4 &&
    inputs.risk.failureConsequence <= 3 &&
    inputs.risk.blastRadius <= 3 &&
    inputs.systems.verification >= 4 &&
    inputs.systems.observability >= 3 &&
    inputs.systems.permissionComplexity <= 3 &&
    inputs.risk.regulatorySensitivity <= 3 &&
    inputs.risk.humanJudgment <= 3 &&
    inputs.systems.systemAccess >= 4 &&
    inputs.systems.toolingReadiness >= 4 &&
    inputs.structure.exceptionRate <= 3 &&
    inputs.structure.ruleClarity >= 4 &&
    inputs.humanLoop.escalationAvailability >= 3 &&
    inputs.humanLoop.feedbackAvailability >= 3
  );
}

function meetsAutonomous(inputs: AssessmentInputs): boolean {
  return (
    meetsBounded(inputs) &&
    inputs.risk.reversibility >= 4 &&
    inputs.risk.failureConsequence <= 2 &&
    inputs.risk.blastRadius <= 2 &&
    inputs.systems.verification >= 5 &&
    inputs.systems.observability >= 4 &&
    inputs.systems.permissionComplexity <= 2 &&
    inputs.risk.regulatorySensitivity <= 2 &&
    inputs.structure.exceptionRate <= 2 &&
    inputs.risk.humanJudgment <= 2 &&
    inputs.humanLoop.escalationAvailability >= 4 &&
    inputs.humanLoop.feedbackAvailability >= 4 &&
    scaleToUnit(inputs.economics.variability) <= 0.5
  );
}

export function fieldPosition(inputs: AssessmentInputs): {
  x: number;
  y: number;
  zone: "assist" | "supervised" | "bounded";
} {
  const reversibility = scaleToUnit(inputs.risk.reversibility);
  const consequence = scaleToUnit(inputs.risk.failureConsequence);
  const blast = scaleToUnit(inputs.risk.blastRadius);
  const riskX = clamp01(consequence * 0.65 + blast * 0.35);
  const controlY = clamp01(
    reversibility * 0.45 +
      scaleToUnit(inputs.systems.verification) * 0.35 +
      scaleToUnit(inputs.systems.observability) * 0.2,
  );
  const x = clamp01(0.12 + (1 - reversibility) * 0.38 + riskX * 0.42);
  const y = clamp01(0.16 + controlY * 0.68);
  const level = recommendAutonomy(inputs);
  const zone = level >= 4 ? "bounded" : level >= 3 ? "supervised" : "assist";
  return { x, y, zone };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
