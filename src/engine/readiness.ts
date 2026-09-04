import type { AssessmentInputs, AutonomyLevel, ConfidenceLevel, ReadinessLevel } from "@/domain/types";
import { completeness, midpointShare } from "./normalize";

export function classifyReadiness(
  inputs: AssessmentInputs,
  autonomy: AutonomyLevel,
): { readiness: ReadinessLevel; note: string } {
  const missing: string[] = [];
  if (inputs.systems.systemAccess <= 2) missing.push("programmatic system access");
  if (inputs.systems.toolingReadiness <= 2) missing.push("stable tools or APIs");
  if (inputs.systems.observability <= 2) missing.push("traceability");
  if (inputs.risk.failureConsequence >= 4 && inputs.systems.verification <= 2) {
    missing.push("deterministic verification for high-consequence actions");
  }
  if (inputs.risk.reversibility <= 2 && inputs.systems.verification <= 2) {
    missing.push("verification or rollback for irreversible work");
  }
  if (inputs.humanLoop.escalationAvailability <= 2 && autonomy >= 3) {
    missing.push("an available escalation path");
  }

  if (missing.length >= 3 || (missing.length >= 2 && inputs.systems.systemAccess <= 2)) {
    return {
      readiness: "Not Ready",
      note: `Critical prerequisites missing: ${missing.slice(0, 3).join("; ")}.`,
    };
  }

  const productionShape =
    inputs.systems.systemAccess >= 4 &&
    inputs.systems.toolingReadiness >= 4 &&
    inputs.systems.observability >= 4 &&
    inputs.systems.verification >= 4 &&
    inputs.humanLoop.escalationAvailability >= 3 &&
    inputs.humanLoop.feedbackAvailability >= 3 &&
    (inputs.risk.reversibility >= 3 || inputs.systems.verification >= 4);

  if (productionShape && autonomy >= 2 && missing.length === 0) {
    return {
      readiness: "Production Candidate",
      note: "The architecture and controls could support a production experiment. AgentFit does not authorize deployment.",
    };
  }

  const pilotShape =
    inputs.systems.systemAccess >= 3 &&
    inputs.systems.toolingReadiness >= 3 &&
    inputs.systems.observability >= 3 &&
    (inputs.systems.verification >= 3 || inputs.risk.reversibility >= 3) &&
    missing.length <= 1;

  if (pilotShape && autonomy >= 2) {
    return {
      readiness: "Pilot Ready",
      note: "Enough structure exists for a limited, instrumented pilot under explicit approval boundaries.",
    };
  }

  if (missing.length > 0) {
    return {
      readiness: "Discovery Ready",
      note: `Worth prototyping while closing: ${missing.slice(0, 2).join("; ")}.`,
    };
  }

  return {
    readiness: "Discovery Ready",
    note: "Worth a bounded prototype to test whether the operating model actually changes.",
  };
}

export function classifyConfidence(inputs: AssessmentInputs): {
  confidence: ConfidenceLevel;
  reasons: string[];
} {
  const reasons: string[] = [];
  const complete = completeness(inputs);
  if (!inputs.name.trim()) reasons.push("Workflow is unnamed.");
  if (inputs.economics.volume <= 0) reasons.push("Volume is unset.");
  if (inputs.economics.minutesPerCase <= 0) reasons.push("Time per case is unset.");
  if (inputs.economics.loadedHourlyCost == null) {
    reasons.push("Loaded cost omitted — economics reported as capacity, not value.");
  }
  if (inputs.archetype === "custom" && midpointShare(inputs) >= 0.65) {
    reasons.push("Most dimensions remain at the midpoint — treat this as a sketch.");
  }

  const contradictions: string[] = [];
  if (inputs.systems.systemAccess >= 4 && inputs.systems.toolingReadiness <= 2) {
    contradictions.push("Strong data access with weak tooling.");
  }
  if (inputs.structure.ruleClarity >= 4 && inputs.structure.exceptionRate >= 4) {
    contradictions.push("Rules are marked clear while exceptions are common.");
  }
  if (inputs.risk.reversibility >= 4 && inputs.risk.failureConsequence >= 5) {
    contradictions.push("Actions marked reversible yet consequence is severe — confirm this.");
  }
  if (inputs.systems.verification <= 2 && inputs.risk.failureConsequence >= 4) {
    contradictions.push("High consequence without cheap verification.");
  }
  reasons.push(...contradictions);

  if (complete >= 0.9 && contradictions.length === 0 && inputs.name.trim().length > 1) {
    return { confidence: "High", reasons: reasons.length ? reasons : ["Inputs are complete and internally consistent."] };
  }
  if (complete >= 0.7 && contradictions.length <= 1) {
    return { confidence: "Medium", reasons };
  }
  if (reasons.length === 0) reasons.push("Several inputs remain coarse or incomplete.");
  return { confidence: "Low", reasons };
}
