import type { AssessmentInputs, EvaluationResult, FmeaItem, RiskItem } from "@/domain/types";
import { gateTally } from "./gates";

export type BriefExtras = {
  notes?: string;
  successCriteria?: string[];
  risks?: RiskItem[];
  fmea?: FmeaItem[];
};

export function briefText(
  inputs: AssessmentInputs,
  result: EvaluationResult,
  extras: string | BriefExtras = "",
): string {
  const options: BriefExtras = typeof extras === "string" ? { notes: extras } : extras;
  const notes = options.notes ?? "";
  const criteria = (options.successCriteria ?? result.experiment.successCriteria).filter((item) => item.trim());
  const risks = options.risks ?? result.risks;
  const fmea = options.fmea ?? result.fmea;
  const tally = gateTally(result.goNoGo);
  const fails = result.goNoGo.filter((gate) => gate.status === "fail");

  return [
    `AgentFit decision brief — ${inputs.name.trim() || "Untitled workflow"}`,
    result.modelLabel,
    "",
    inputs.description,
    notes.trim() ? `\nNotes\n${notes.trim()}` : "",
    "",
    `Agent Fit: ${result.score}/100`,
    `Autonomy: ${result.autonomyLabel}`,
    `Pattern: ${result.pattern}`,
    `Class: ${result.portfolioClass}`,
    `Control: ${result.controlPosture}`,
    `Capacity: ${result.capacity.netCapacityReturned} hrs/week potential`,
    `Readiness: ${result.readiness}`,
    `Confidence: ${result.confidence} · completeness ${Math.round(result.completeness * 100)}%`,
    `Design: ${result.design.stepCount} steps · ${result.design.systemCount} systems · ${result.design.writeSystemCount} write/admin`,
    `Gates: ${tally.pass} pass · ${tally.warn} warn · ${tally.fail} fail`,
    "",
    "Verdict",
    result.verdict,
    "",
    "Therefore",
    result.explanation.therefore,
    "",
    "Limiting factors",
    ...result.explanation.limitingFactors.map((item) => `– ${item}`),
    ...(result.blockers.length
      ? ["", "What caps autonomy", ...result.blockers.map((item) => `– ${item.title}: ${item.detail}`)]
      : []),
    ...(inputs.workflow.steps.length
      ? [
          "",
          "Workflow map",
          ...inputs.workflow.steps.map(
            (step, i) =>
              `– ${i + 1}. ${step.name || "Unnamed"} [${step.actor}] ${step.action || ""}` +
              (step.failureMode ? ` · fail: ${step.failureMode}` : ""),
          ),
        ]
      : []),
    ...(inputs.inventory.systems.length
      ? [
          "",
          "Systems inventory",
          ...inputs.inventory.systems.map(
            (system) => `– ${system.name || "Unnamed"} · ${system.access} · crit ${system.criticality}`,
          ),
        ]
      : []),
    ...(fails.length
      ? ["", "Failed gates", ...fails.map((gate) => `– ${gate.label}: ${gate.detail}`)]
      : ["", "Failed gates", "– None"]),
    "",
    "Next experiment",
    result.experiment.title,
    result.experiment.rationale,
    ...(criteria.length ? ["", "Success criteria", ...criteria.map((item) => `– ${item}`)] : []),
    ...(risks.length
      ? [
          "",
          "Risks and mitigations",
          ...risks.map((item) => `– ${item.risk}: ${item.mitigation || "(mitigation unset)"}`),
        ]
      : []),
    ...(fmea.length
      ? [
          "",
          "FMEA (top)",
          ...fmea
            .slice(0, 6)
            .map((item) => `– RPN ${item.rpn} · ${item.failure}: ${item.mitigation || "(mitigation unset)"}`),
        ]
      : []),
    "",
    "AgentFit supports discovery and system design. It does not authorize production deployment.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
