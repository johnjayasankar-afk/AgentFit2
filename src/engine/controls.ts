import type {
  AssessmentInputs,
  AutonomyLevel,
  ControlId,
  ControlPrimitive,
} from "@/domain/types";

const CATALOG: Record<ControlId, Omit<ControlPrimitive, "rationale"> & { rationale: string }> = {
  human_approval: {
    id: "human_approval",
    label: "Human approval",
    rationale: "Consequential actions require an accountable person before they execute.",
  },
  read_only_tools: {
    id: "read_only_tools",
    label: "Read-only tools",
    rationale: "The system may inspect state but cannot mutate it.",
  },
  typed_actions: {
    id: "typed_actions",
    label: "Typed actions",
    rationale: "Writes go through a closed, schema-checked action set — not free-form side effects.",
  },
  allowlisted_tools: {
    id: "allowlisted_tools",
    label: "Allowlisted tools",
    rationale: "Only named tools may be invoked; discovery of new tools is closed.",
  },
  transaction_limits: {
    id: "transaction_limits",
    label: "Transaction limits",
    rationale: "Magnitude caps keep a single run from moving material value.",
  },
  rate_limits: {
    id: "rate_limits",
    label: "Rate limits",
    rationale: "Throughput caps contain blast radius if the loop misfires.",
  },
  confidence_threshold: {
    id: "confidence_threshold",
    label: "Confidence threshold",
    rationale: "Low-certainty cases escalate instead of executing.",
  },
  deterministic_validation: {
    id: "deterministic_validation",
    label: "Deterministic validation",
    rationale: "Post-conditions are checked by rules, not by the same model that proposed the action.",
  },
  schema_validation: {
    id: "schema_validation",
    label: "Schema validation",
    rationale: "Outputs must satisfy a contract before they can proceed.",
  },
  pre_action_simulation: {
    id: "pre_action_simulation",
    label: "Pre-action simulation",
    rationale: "Dry-run the mutation against current state before commit.",
  },
  dual_approval: {
    id: "dual_approval",
    label: "Dual approval",
    rationale: "Two informed humans must authorize the highest-consequence class of action.",
  },
  audit_log: {
    id: "audit_log",
    label: "Audit log",
    rationale: "Every retrieval, plan, tool call, and decision is reconstructable.",
  },
  rollback: {
    id: "rollback",
    label: "Rollback",
    rationale: "Failed or incorrect commits can be inverted without heroic recovery.",
  },
  timeout: {
    id: "timeout",
    label: "Timeout",
    rationale: "Open-ended loops are killed; work returns to a human.",
  },
  restricted_data_access: {
    id: "restricted_data_access",
    label: "Restricted data access",
    rationale: "The runtime sees only the fields required for the current case.",
  },
  exception_escalation: {
    id: "exception_escalation",
    label: "Exception escalation",
    rationale: "Out-of-policy cases leave the machine path immediately.",
  },
  sandbox_execution: {
    id: "sandbox_execution",
    label: "Sandbox execution",
    rationale: "New behaviors run against isolated data or paper trades first.",
  },
  idempotency: {
    id: "idempotency",
    label: "Idempotency",
    rationale: "Retries cannot double-apply a write.",
  },
  reconciliation: {
    id: "reconciliation",
    label: "Reconciliation",
    rationale: "Machine output is compared to a source of truth on a schedule.",
  },
  monitoring: {
    id: "monitoring",
    label: "Monitoring",
    rationale: "Override rate, exception rate, and tool failure are visible in operations.",
  },
};

export function recommendControls(
  inputs: AssessmentInputs,
  autonomy: AutonomyLevel,
): { required: ControlPrimitive[]; beforeIncrease: ControlPrimitive[] } {
  const required = new Set<ControlId>();
  const later = new Set<ControlId>();

  required.add("audit_log");
  required.add("monitoring");
  required.add("exception_escalation");

  if (autonomy === 0) {
    required.add("schema_validation");
    required.add("idempotency");
  }

  if (autonomy >= 1) {
    required.add("schema_validation");
    required.add("restricted_data_access");
  }

  if (autonomy <= 2) {
    required.add("read_only_tools");
  }

  if (autonomy >= 2) {
    required.add("allowlisted_tools");
    required.add("confidence_threshold");
  }

  if (autonomy >= 3) {
    required.add("typed_actions");
    required.add("human_approval");
    required.add("timeout");
    required.add("idempotency");
  }

  if (autonomy >= 4) {
    required.add("rollback");
    required.add("deterministic_validation");
    required.add("rate_limits");
    required.add("sandbox_execution");
  }

  if (inputs.risk.reversibility <= 3) {
    required.add("human_approval");
    required.add("pre_action_simulation");
    later.add("rollback");
  }

  if (inputs.risk.failureConsequence >= 4 || inputs.risk.blastRadius >= 4) {
    required.add("human_approval");
    required.add("transaction_limits");
    required.add("deterministic_validation");
    later.add("dual_approval");
    later.add("pre_action_simulation");
  }

  if (inputs.risk.regulatorySensitivity >= 4) {
    required.add("human_approval");
    required.add("restricted_data_access");
    required.add("audit_log");
    later.add("dual_approval");
  }

  if (inputs.systems.permissionComplexity >= 4) {
    required.add("allowlisted_tools");
    required.add("restricted_data_access");
    later.add("transaction_limits");
  }

  if (inputs.systems.verification <= 3) {
    later.add("deterministic_validation");
    later.add("schema_validation");
  } else {
    required.add("deterministic_validation");
  }

  if (inputs.systems.observability <= 3) {
    later.add("audit_log");
    later.add("monitoring");
  }

  if (inputs.structure.exceptionRate >= 4) {
    required.add("exception_escalation");
    required.add("confidence_threshold");
  }

  if (inputs.risk.humanJudgment >= 4) {
    required.add("human_approval");
    later.add("confidence_threshold");
  }

  if (inputs.archetype === "reconciliation" || inputs.archetype === "payment_exception") {
    required.add("reconciliation");
    required.add("idempotency");
  }

  if (autonomy < 4) {
    later.add("rollback");
    later.add("sandbox_execution");
    later.add("rate_limits");
  }
  if (autonomy < 3) {
    later.add("typed_actions");
    later.add("human_approval");
  }
  if (autonomy < 5) {
    later.add("dual_approval");
  }

  const requiredList = [...required].map((id) => CATALOG[id]);
  const laterList = [...later]
    .filter((id) => !required.has(id))
    .map((id) => CATALOG[id]);

  return { required: requiredList, beforeIncrease: laterList };
}

export function controlPostureCopy(inputs: AssessmentInputs, autonomy: AutonomyLevel): string {
  if (autonomy === 0) return "Rules and scripts; no generative execution path";
  if (autonomy === 1) return "Human interprets and executes";
  if (autonomy === 2) return "Human initiates; machine drafts and recommends";
  if (autonomy >= 5) return "Independent execution inside declared bounds";
  if (autonomy === 4) {
    return inputs.risk.failureConsequence >= 3
      ? "Independent inside limits; exceptions escalate"
      : "Bounded execution with rollback and thresholds";
  }
  if (inputs.risk.reversibility <= 2 || inputs.risk.failureConsequence >= 4) {
    return "Human approval before irreversible action";
  }
  return "Human approval for consequential writes";
}
