import { isConventionalSoftware, isHumanLedCeiling } from "./autonomy";
import type { AssessmentInputs, AutonomyBlocker, AutonomyLevel } from "@/domain/types";

/**
 * Why independence is capped here. Separate from Agent Fit.
 * Ordered by how hard they bind the autonomy ceiling.
 */
export function autonomyBlockers(inputs: AssessmentInputs, autonomy: AutonomyLevel): AutonomyBlocker[] {
  const items: AutonomyBlocker[] = [];
  const r = inputs.risk;
  const s = inputs.systems;
  const st = inputs.structure;
  const h = inputs.humanLoop;

  if (isConventionalSoftware(inputs) || autonomy === 0) {
    items.push({
      id: "conventional",
      title: "A script is the better product",
      detail: "Rules are explicit, inputs are structured, and judgment is not the work. Generative autonomy would add a control plane without adding leverage.",
    });
  }

  if (isHumanLedCeiling(inputs)) {
    items.push({
      id: "human-led",
      title: "Expert judgment is still the product",
      detail: "Rules are ambiguous, consequence is high, and a competent specialist still has to see the case. Assist; do not execute.",
    });
  }

  if (s.systemAccess <= 2 || s.toolingReadiness <= 2) {
    items.push({
      id: "access",
      title: "Access is the ceiling",
      detail: "Without reliable retrieval and typed tools, an agent invents context or clicks through UIs. Infrastructure first.",
    });
  }

  if (r.failureConsequence >= 4 || r.blastRadius >= 4) {
    items.push({
      id: "consequence",
      title: "Consequence caps independence",
      detail: "A miss is expensive or systemic. High Agent Fit does not license unattended writes.",
    });
  }

  if (r.reversibility <= 2) {
    items.push({
      id: "reversibility",
      title: "Actions are hard to reverse",
      detail: "Irreversible work stays behind an approval gate until rollback or compensating transactions exist.",
    });
  }

  if (s.verification <= 2) {
    items.push({
      id: "verification",
      title: "Output is expensive to verify",
      detail: "If only an expert can check the answer, the expert is still on the critical path.",
    });
  }

  if (r.regulatorySensitivity >= 4) {
    items.push({
      id: "policy",
      title: "Policy constrains unattended action",
      detail: "Assistance is compatible with regulation. Unattended, unaudited execution is not.",
    });
  }

  if (s.permissionComplexity >= 4) {
    items.push({
      id: "permissions",
      title: "Permission scope is too broad",
      detail: "Privileged identity turns a local miss into an incident. Split the runtime before raising autonomy.",
    });
  }

  if (h.escalationAvailability <= 2 && autonomy >= 2) {
    items.push({
      id: "escalation",
      title: "No one is waiting for the exception",
      detail: "Autonomy without an informed human on the other side of the handoff is abdication.",
    });
  }

  if (st.exceptionRate >= 4) {
    items.push({
      id: "exceptions",
      title: "The long tail is the work",
      detail: "Common exceptions mean the happy path is not the product. Narrow the slice before expanding autonomy.",
    });
  }

  const unique: AutonomyBlocker[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique.slice(0, 4);
}
