import type { AssessmentInputs, AutonomyLevel, SystemPattern } from "@/domain/types";
import { conventionalAffinity } from "./score";
import { isHumanLedCeiling } from "./autonomy";

export function recommendPattern(inputs: AssessmentInputs, autonomy: AutonomyLevel): SystemPattern {
  if (isHumanLedCeiling(inputs) && autonomy <= 2 && conventionalAffinity(inputs) < 0.7) {
    if (inputs.structure.contextBreadth >= 3 && inputs.systems.systemAccess >= 3) {
      return "Retrieval + Assist";
    }
    return autonomy <= 1 ? "Human-Led Process" : "AI Assist";
  }

  if (autonomy === 0 || conventionalAffinity(inputs) >= 0.84) {
    return "Deterministic Automation";
  }

  if (shouldOrchestrate(inputs, autonomy)) {
    return "Multi-Agent Orchestration";
  }

  if (autonomy >= 4) return "Bounded Execution Agent";
  if (autonomy === 3) return "Supervised Tool Agent";
  if (autonomy === 2) {
    if (inputs.systems.systemAccess >= 3 && inputs.systems.toolingReadiness >= 3) {
      return inputs.risk.reversibility >= 3 && inputs.risk.failureConsequence <= 3
        ? "Tool-Using Assistant"
        : "Retrieval + Assist";
    }
    return inputs.structure.contextBreadth >= 3 ? "Retrieval + Assist" : "AI Assist";
  }
  if (inputs.structure.contextBreadth >= 3) return "Retrieval + Assist";
  return "AI Assist";
}

function shouldOrchestrate(inputs: AssessmentInputs, autonomy: AutonomyLevel): boolean {
  const decomposable =
    inputs.archetype === "research" ||
    inputs.archetype === "software_development" ||
    inputs.archetype === "reconciliation";
  return (
    autonomy >= 3 &&
    decomposable &&
    inputs.structure.contextBreadth >= 5 &&
    inputs.systems.systemAccess >= 4 &&
    inputs.systems.toolingReadiness >= 4 &&
    inputs.risk.humanJudgment <= 3
  );
}

export function architectureFor(pattern: SystemPattern): { id: string; label: string }[] {
  switch (pattern) {
    case "Deterministic Automation":
      return nodes("EVENT", "RULES / SCRIPT", "VALIDATION", "COMMIT", "AUDIT");
    case "Human-Led Process":
      return nodes("USER", "CONTEXT", "HUMAN DECISION", "ACTION", "RECORD");
    case "AI Assist":
      return nodes("USER", "MODEL", "DRAFT / RECOMMENDATION", "HUMAN");
    case "Retrieval + Assist":
      return nodes("USER", "CONTEXT RETRIEVAL", "MODEL", "DRAFT / RECOMMENDATION", "HUMAN");
    case "Tool-Using Assistant":
      return nodes("USER", "CONTEXT", "ASSISTANT", "READ-ONLY TOOL", "HUMAN EXECUTES");
    case "Supervised Tool Agent":
      return nodes(
        "USER / EVENT",
        "CONTEXT RETRIEVAL",
        "AGENT",
        "POLICY GATE",
        "TYPED TOOL",
        "VALIDATION",
        "HUMAN APPROVAL",
        "COMMIT",
        "AUDIT",
      );
    case "Bounded Execution Agent":
      return nodes(
        "EVENT",
        "CONTEXT",
        "AGENT",
        "POLICY / LIMITS",
        "TYPED TOOL",
        "VALIDATION",
        "COMMIT",
        "RECONCILE",
        "AUDIT",
      );
    case "Multi-Agent Orchestration":
      return nodes(
        "EVENT",
        "ROUTER",
        "SPECIALIST AGENTS",
        "POLICY GATE",
        "TYPED TOOL",
        "VALIDATION",
        "HUMAN / COMMIT",
        "AUDIT",
      );
  }
}

function nodes(...labels: string[]) {
  return labels.map((label, i) => ({ id: `${i}`, label }));
}
