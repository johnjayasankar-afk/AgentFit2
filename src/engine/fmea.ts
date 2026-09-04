import type {
  AssessmentInputs,
  EvaluationResult,
  FmeaItem,
  RiskItem,
  Scale,
} from "@/domain/types";

function sid(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}

function asScale(n: number): Scale {
  const rounded = Math.max(1, Math.min(5, Math.round(n)));
  return rounded as Scale;
}

/** Build an FMEA register from workflow map, systems inventory, and scored risks. Does not alter Model 1.0 fit. */
export function buildFmea(inputs: AssessmentInputs, risks: RiskItem[]): FmeaItem[] {
  const items: FmeaItem[] = [];
  let n = 0;

  for (const step of inputs.workflow.steps) {
    if (!step.failureMode.trim() && step.reversible) continue;
    const failure = step.failureMode.trim() || `Step fails: ${step.name || "unnamed step"}`;
    const severity = asScale(step.reversible ? inputs.risk.failureConsequence : Math.max(inputs.risk.failureConsequence, 4));
    const occurrence = asScale(inputs.structure.exceptionRate);
    const detection = asScale(6 - inputs.systems.observability);
    items.push({
      id: sid("fmea-wf", ++n),
      failure,
      cause: `${step.actor} action · ${step.action || "undefined action"}`,
      effect: step.reversible
        ? "Recoverable disruption; rollback path exists."
        : "Hard-to-reverse effect; consequence compounds.",
      severity,
      occurrence,
      detection,
      rpn: severity * occurrence * detection,
      mitigation: step.reversible
        ? "Keep human confirmation; verify rollback before unattended runs."
        : "Gate this step; require approval and dual-control before write.",
      source: "workflow",
    });
  }

  for (const system of inputs.inventory.systems) {
    if (system.access === "none" || system.access === "read") continue;
    const severity = asScale(Math.max(system.criticality, inputs.risk.blastRadius));
    const occurrence = asScale(inputs.systems.permissionComplexity);
    const detection = asScale(6 - inputs.systems.observability);
    items.push({
      id: sid("fmea-sys", ++n),
      failure: `Unauthorized or incorrect write to ${system.name || "system"}`,
      cause: `${system.access} access · ${system.notes.trim() || "no notes"}`,
      effect: "Data corruption, customer impact, or policy breach.",
      severity,
      occurrence,
      detection,
      rpn: severity * occurrence * detection,
      mitigation: "Least privilege, allow-list tools, and audit every write.",
      source: "system",
    });
  }

  for (const risk of risks.slice(0, 6)) {
    const severity = risk.severity;
    const occurrence = asScale(inputs.structure.exceptionRate);
    const detection = asScale(6 - Math.max(inputs.systems.verification, inputs.systems.observability) / 1);
    items.push({
      id: sid("fmea-risk", ++n),
      failure: risk.risk,
      cause: risk.why,
      effect: "Materializes the scored risk profile for this workflow.",
      severity,
      occurrence,
      detection,
      rpn: severity * occurrence * detection,
      mitigation: risk.mitigation,
      source: "risk",
    });
  }

  return items.sort((a, b) => b.rpn - a.rpn).slice(0, 12);
}

export function summarizeDesign(inputs: AssessmentInputs): EvaluationResult["design"] {
  const steps = inputs.workflow.steps;
  const systems = inputs.inventory.systems;
  const writeSystemCount = systems.filter((s) => s.access === "write" || s.access === "admin").length;
  const irreversibleSteps = steps.filter((s) => !s.reversible).length;
  const humanOnlySteps = steps.filter((s) => s.actor === "human").length;
  const stepSignal = steps.length === 0 ? 0 : Math.min(1, steps.length / 4);
  const systemSignal = systems.length === 0 ? 0 : Math.min(1, systems.length / 3);
  const namedSteps = steps.filter((s) => s.name.trim() && s.action.trim()).length;
  const detailSignal = steps.length === 0 ? 0 : namedSteps / steps.length;
  return {
    stepCount: steps.length,
    systemCount: systems.length,
    writeSystemCount,
    irreversibleSteps,
    humanOnlySteps,
    mappedCompleteness: Math.round(((stepSignal + systemSignal + detailSignal) / 3) * 100) / 100,
  };
}
