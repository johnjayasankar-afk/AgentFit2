import type { AssessmentInputs, EvaluationResult, GoNoGoGate } from "@/domain/types";

/** Deterministic go / no-go checklist. Separate from readiness — this is a decide instrument. */
export function buildGoNoGo(inputs: AssessmentInputs, result: EvaluationResult): GoNoGoGate[] {
  const design = result.design;
  const gates: GoNoGoGate[] = [];

  gates.push({
    id: "fit-floor",
    label: "Agent Fit supports an agentic investment",
    category: "fit",
    status: result.score >= 60 ? "pass" : result.score >= 40 ? "warn" : "fail",
    detail:
      result.score >= 60
        ? `Fit ${result.score}/100 clears a build-investigation floor.`
        : result.score >= 40
          ? `Fit ${result.score}/100 is marginal — treat as discovery only.`
          : `Fit ${result.score}/100 is too weak for an agent program.`,
  });

  gates.push({
    id: "not-conventional",
    label: "Not better served by conventional automation",
    category: "fit",
    status: result.conventionalAffinity >= 0.55 ? "fail" : result.conventionalAffinity >= 0.4 ? "warn" : "pass",
    detail:
      result.conventionalAffinity >= 0.55
        ? "Conventional affinity is high — prefer a rules engine or script."
        : "Agentic path is not dominated by conventional automation.",
  });

  gates.push({
    id: "autonomy-honest",
    label: "Autonomy recommendation is control-backed",
    category: "autonomy",
    status: result.blockers.length === 0 ? "pass" : result.autonomy <= 2 ? "pass" : "warn",
    detail:
      result.blockers.length === 0
        ? `${result.autonomyLabel} has no hard ceiling from current inputs.`
        : `Capped by: ${result.blockers.map((b) => b.title).join("; ")}.`,
  });

  gates.push({
    id: "readiness",
    label: "Environment readiness for a bounded pilot",
    category: "readiness",
    status:
      result.readiness === "Production Candidate" || result.readiness === "Pilot Ready"
        ? "pass"
        : result.readiness === "Discovery Ready"
          ? "warn"
          : "fail",
    detail: result.readinessNote,
  });

  gates.push({
    id: "controls",
    label: "Required controls are identified",
    category: "controls",
    status: result.controlsRequired.length === 0 ? "warn" : "pass",
    detail:
      result.controlsRequired.length === 0
        ? "No controls listed — unusual; re-check risk and access."
        : `${result.controlsRequired.length} controls required before the recommended autonomy is credible.`,
  });

  gates.push({
    id: "workflow-map",
    label: "Workflow is mapped as steps (not only scores)",
    category: "design",
    status: design.stepCount >= 3 ? "pass" : design.stepCount >= 1 ? "warn" : "fail",
    detail:
      design.stepCount >= 3
        ? `${design.stepCount} steps mapped · ${design.irreversibleSteps} irreversible.`
        : design.stepCount >= 1
          ? "Partial map — add handoffs, writes, and failure modes."
          : "No steps yet. Map the real process before funding an agent.",
  });

  gates.push({
    id: "systems-inventory",
    label: "Systems inventory names what an agent would touch",
    category: "design",
    status: design.systemCount >= 2 ? "pass" : design.systemCount >= 1 ? "warn" : "fail",
    detail:
      design.systemCount === 0
        ? "No systems listed. Inventory APIs, ledgers, and tools with access level."
        : `${design.systemCount} systems · ${design.writeSystemCount} with write/admin access.`,
  });

  gates.push({
    id: "write-gates",
    label: "Write paths have human confirmation where irreversible",
    category: "design",
    status:
      design.writeSystemCount === 0
        ? "pass"
        : design.irreversibleSteps > 0 && result.autonomy >= 3
          ? "fail"
          : design.writeSystemCount > 0 && inputs.risk.reversibility <= 2
            ? "warn"
            : "pass",
    detail:
      design.writeSystemCount === 0
        ? "No write/admin systems inventoried."
        : design.irreversibleSteps > 0 && result.autonomy >= 3
          ? "Irreversible steps + supervised-or-higher autonomy without proven gates is a no-go."
          : "Writes exist — keep approval boundaries in the pilot design.",
  });

  const hours = result.capacity.netCapacityReturned;
  gates.push({
    id: "economics",
    label: "Capacity hypothesis is worth the build cost",
    category: "economics",
    status: hours >= 8 ? "pass" : hours >= 2 ? "warn" : "fail",
    detail: `${hours} hrs/week potential capacity returned under stated assumptions.`,
  });

  gates.push({
    id: "fmea",
    label: "Top failure modes have mitigations",
    category: "controls",
    status:
      result.fmea.length === 0
        ? "unknown"
        : result.fmea.filter((f) => f.rpn >= 40 && !f.mitigation.trim()).length > 0
          ? "fail"
          : result.fmea.some((f) => f.rpn >= 60)
            ? "warn"
            : "pass",
    detail:
      result.fmea.length === 0
        ? "FMEA empty — map steps or raise risk visibility."
        : `Highest RPN ${result.fmea[0]?.rpn ?? 0} · ${result.fmea.filter((f) => f.rpn >= 40).length} items ≥ 40.`,
  });

  gates.push({
    id: "authorization",
    label: "AgentFit does not authorize production deployment",
    category: "readiness",
    status: "warn",
    detail: "Discovery and system design only. A passing checklist is not a go-live decision.",
  });

  return gates;
}

export function gateTally(gates: GoNoGoGate[]): { pass: number; warn: number; fail: number; unknown: number } {
  return gates.reduce(
    (acc, gate) => {
      acc[gate.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, unknown: 0 },
  );
}
