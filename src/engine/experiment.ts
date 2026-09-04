import type {
  AssessmentInputs,
  AutonomyLevel,
  EvalMetric,
  NextExperiment,
  PilotDesign,
  RiskItem,
  SystemPattern,
} from "@/domain/types";

export function recommendExperiment(
  inputs: AssessmentInputs,
  autonomy: AutonomyLevel,
  pattern: SystemPattern,
): NextExperiment {
  if (pattern === "Deterministic Automation") {
    return {
      title: "Do not use generative AI; automate using rules",
      rationale: "The work is explicit enough for a script, workflow engine, or rules table.",
      successCriteria: [
        "Rule coverage of the happy path documented",
        "Exception path leaves the automation",
        "Idempotent writes",
        "Reconciliation against source of truth",
      ],
    };
  }
  if (pattern === "Human-Led Process") {
    return {
      title: "Instrument the workflow before agentification",
      rationale: "Judgment and consequence are too central. Measure the work before introducing a model.",
      successCriteria: [
        "Case types and exception rate captured",
        "Decision policy drafted by an expert",
        "Time-per-case baseline recorded",
        "No generative tool execution",
      ],
    };
  }
  if (inputs.systems.systemAccess <= 2) {
    return {
      title: "Build read-only tool access",
      rationale: "Without reliable retrieval, an agent will guess. Start with context, not action.",
      successCriteria: [
        "Case context assembled from source systems",
        "No write tools exposed",
        "Retrieval groundedness sampled by a human",
        "Time to assemble a case reduced",
      ],
    };
  }
  if (inputs.systems.verification <= 2 && (inputs.risk.failureConsequence >= 4 || inputs.risk.reversibility <= 2)) {
    return {
      title: "Add deterministic verification",
      rationale: "Consequence is high and checking the output is still expensive. Verification is the control, not a larger model.",
      successCriteria: [
        "Post-condition checks that do not use the proposing model",
        "Fail-closed behavior on validation miss",
        "Trace of proposed vs. accepted actions",
        "Zero irreversible execution without approval",
      ],
    };
  }
  if (autonomy <= 1) {
    return {
      title: "Prototype a retrieval-only assistant",
      rationale: "Keep the human as operator. Test whether context assembly and drafting change the operating model.",
      successCriteria: [
        "≥40% of case context assembled automatically",
        "Human still executes every consequential action",
        "Reviewers can cite the retrieved source",
        "No tool writes",
      ],
    };
  }
  if (autonomy === 2) {
    return {
      title: "Pilot an assistive agent on a narrow case class",
      rationale: "The machine prepares; the human still acts. Measure coverage and review time before adding writes.",
      successCriteria: [
        "≥50% case coverage on the chosen class",
        "<8 minute human review",
        "Zero tool execution without a human",
        "Exception rate captured",
      ],
    };
  }
  if (autonomy === 3) {
    return {
      title: "Pilot a supervised agent on 10% of cases",
      rationale: "Allow typed writes only after approval. The question is whether the gate stays cheap.",
      successCriteria: [
        "≥60% case coverage on the pilot slice",
        "<5 minute human review",
        "Zero irreversible tool execution without approval",
        "Full event traceability",
        "Exception rate captured",
      ],
    };
  }
  return {
    title: "Run a bounded execution canary",
    rationale: "Independent action is only justified inside declared limits, with rollback and an exit ramp.",
    successCriteria: [
      "Hard transaction and rate limits enforced",
      "Rollback proven on injected failure",
      "Override and exception rates below the agreed threshold",
      "Canary population only",
      "Human can halt the runtime",
    ],
  };
}

export function recommendPilot(
  inputs: AssessmentInputs,
  autonomy: AutonomyLevel,
  pattern: SystemPattern,
): PilotDesign {
  const name = inputs.name.trim() || "this workflow";
  const supervised = autonomy >= 3;
  return {
    scope: `A single case class inside ${name}, representing the cleanest 10–20% of volume — not the long tail.`,
    userGroup: inputs.economics.peopleInvolved
      ? `The operators already doing the work (${inputs.economics.peopleInvolved} people), plus one accountable reviewer.`
      : "The operators already doing the work, plus one accountable reviewer.",
    allowedActions: allowed(autonomy, pattern),
    disallowedActions: disallowed(inputs, autonomy),
    approvalBoundary: supervised
      ? "Any write that is irreversible, crosses a money/permission threshold, or fails validation requires a human."
      : "The human remains the executor. The system may draft and retrieve only.",
    fallbackBehavior: "On uncertainty, tool failure, or policy miss: stop, preserve the draft, and escalate. Do not retry writes blindly.",
    loggingRequirement: "Log retrievals, plans, tool calls, approvals, overrides, and outcomes. A reviewer must be able to reconstruct a case.",
    evaluationMetrics: recommendEvalMetrics(inputs, autonomy).map((m) => m.label),
    exitCriteria: [
      "Error or override rate exceeds the agreed threshold",
      "Approval latency erases the capacity hypothesis",
      "A single incident with material blast radius",
      "Operators stop trusting the draft and ignore it",
    ],
  };
}

function allowed(autonomy: AutonomyLevel, pattern: SystemPattern): string[] {
  if (pattern === "Deterministic Automation") {
    return ["Rule evaluation", "Deterministic writes inside the declared script", "Exception routing"];
  }
  if (autonomy <= 1) return ["Retrieve context", "Summarize", "Suggest next questions"];
  if (autonomy === 2) return ["Retrieve context", "Draft a recommendation", "Propose a next action", "Read-only tool calls"];
  if (autonomy === 3) {
    return ["Multi-step research", "Typed tool calls", "Draft writes", "Execute only after approval"];
  }
  return ["Independent execution inside allowlisted tools", "Automatic rollback on validation miss", "Escalation of exceptions"];
}

function disallowed(inputs: AssessmentInputs, autonomy: AutonomyLevel): string[] {
  const list = ["Free-form code execution", "Unallowlisted tools", "Silent retries of failed writes"];
  if (autonomy < 4) list.push("Unattended irreversible action");
  if (inputs.risk.regulatorySensitivity >= 4) list.push("Access to data outside the case");
  if (inputs.systems.permissionComplexity >= 4) list.push("Privilege escalation or admin actions");
  return list;
}

export function recommendEvalMetrics(inputs: AssessmentInputs, autonomy: AutonomyLevel): EvalMetric[] {
  const metrics: EvalMetric[] = [
    { id: "completion", label: "Task completion", why: "Did the case actually finish." },
    { id: "review_time", label: "Review time", why: "Whether the human gate remains economically viable." },
    { id: "exception_detection", label: "Exception detection", why: "Whether messy cases leave the machine path." },
  ];
  if (autonomy >= 1) {
    metrics.push({ id: "groundedness", label: "Groundedness", why: "Claims should be traceable to retrieved context." });
  }
  if (autonomy >= 2) {
    metrics.push({ id: "accuracy", label: "Accuracy", why: "Drafts and recommendations versus expert judgment." });
    metrics.push({ id: "false_escalation", label: "False escalation", why: "Over-abstention burns the capacity hypothesis." });
    metrics.push({ id: "missed_escalation", label: "Missed escalation", why: "The expensive failure: acting when it should have stopped." });
  }
  if (autonomy >= 3) {
    metrics.push({ id: "tool_success", label: "Tool success", why: "Typed actions must complete or fail closed." });
    metrics.push({ id: "human_override", label: "Human override", why: "How often approval becomes a rewrite." });
    metrics.push({ id: "latency", label: "Latency", why: "End-to-end time including the approval gate." });
  }
  if (autonomy >= 4) {
    metrics.push({ id: "rollback_rate", label: "Rollback rate", why: "How often independent execution has to be inverted." });
  }
  if (inputs.economics.loadedHourlyCost != null) {
    metrics.push({ id: "cost_per_case", label: "Cost per case", why: "Model, review, and tool cost versus the current path." });
  }
  return metrics;
}

export function generateRiskRegister(inputs: AssessmentInputs): RiskItem[] {
  const items: RiskItem[] = [];
  const push = (
    id: string,
    cond: boolean,
    risk: string,
    why: string,
    severity: RiskItem["severity"],
    mitigation: string,
  ) => {
    if (cond) items.push({ id, risk, why, severity, mitigation });
  };

  push(
    "irreversible",
    inputs.risk.reversibility <= 2,
    "Irreversible action",
    "A miss cannot be cheaply undone.",
    inputs.risk.failureConsequence >= 4 ? 5 : 4,
    "Approval before commit; prefer simulation and compensating transactions.",
  );
  push(
    "verification",
    inputs.systems.verification <= 2,
    "Incomplete verification",
    "There is no cheap way to know whether the output is correct.",
    4,
    "Add deterministic post-conditions before expanding autonomy.",
  );
  push(
    "permissions",
    inputs.systems.permissionComplexity >= 4,
    "Broad permission scope",
    "The runtime would inherit privileged or complex authority.",
    4,
    "Split identities. Allowlist tools. Restrict data to the current case.",
  );
  push(
    "consequence",
    inputs.risk.failureConsequence >= 4,
    "High consequence",
    "A wrong action is expensive in money, trust, or compliance.",
    5,
    "Keep a human on irreversible and high-magnitude writes.",
  );
  push(
    "blast",
    inputs.risk.blastRadius >= 4,
    "Systemic blast radius",
    "One run can touch many customers or material exposure.",
    5,
    "Transaction limits, canaries, and rate limits before any unattended loop.",
  );
  push(
    "sensitive",
    inputs.risk.regulatorySensitivity >= 4,
    "Sensitive information or policy constraint",
    "The workflow sits inside a regulated or tightly policed domain.",
    4,
    "Restricted data access, full audit, and dual approval for the highest class.",
  );
  push(
    "escalation",
    inputs.humanLoop.escalationAvailability <= 2,
    "Unavailable escalation",
    "When the machine abstains, nobody informed is waiting.",
    4,
    "Do not raise autonomy until an on-call or reviewer path exists.",
  );
  push(
    "observability",
    inputs.systems.observability <= 2,
    "Poor observability",
    "It will be difficult to reconstruct what happened.",
    3,
    "Instrument plans, tool calls, and decisions before a pilot.",
  );
  push(
    "judgment",
    inputs.risk.humanJudgment >= 4,
    "Irreducible expert judgment",
    "A competent specialist still has to see the case.",
    3,
    "Keep the human as decision-maker; use the machine for assembly and draft.",
  );
  push(
    "exceptions",
    inputs.structure.exceptionRate >= 4,
    "High exception rate",
    "The long tail is the work, not the edge.",
    3,
    "Classify case types first. Automate only the clean slice.",
  );
  push(
    "access",
    inputs.systems.systemAccess <= 2,
    "Manual system access",
    "Context still lives in swivel-chair retrieval.",
    3,
    "Build read APIs before any agent that must act.",
  );

  return items.sort((a, b) => b.severity - a.severity);
}
