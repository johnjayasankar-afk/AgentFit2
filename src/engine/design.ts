import type { AssessmentInputs, SystemsInventory, WorkflowMap } from "@/domain/types";

export function emptyWorkflow(): WorkflowMap {
  return { steps: [] };
}

export function emptyInventory(): SystemsInventory {
  return { systems: [] };
}

/** Normalize legacy assessments missing workflow/inventory without failing evaluate. */
export function normalizeInputs(inputs: AssessmentInputs): AssessmentInputs {
  return {
    ...inputs,
    workflow: inputs.workflow?.steps ? inputs.workflow : emptyWorkflow(),
    inventory: inputs.inventory?.systems ? inputs.inventory : emptyInventory(),
  };
}

export function newStepId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newSystemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sys_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
