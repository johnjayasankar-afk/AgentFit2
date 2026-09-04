import type { AssessmentInputs, Scale, WorkflowArchetype } from "@/domain/types";

export const ARCHETYPE_LABELS: Record<WorkflowArchetype, string> = {
  operations_setup: "Operations setup",
  support_triage: "Support triage",
  payment_exception: "Payment exception",
  document_review: "Document review",
  reconciliation: "Reconciliation",
  research: "Research",
  data_analysis: "Data analysis",
  client_onboarding: "Client onboarding",
  compliance_review: "Compliance review",
  internal_approval: "Internal approval",
  monitoring: "Monitoring",
  scheduling: "Scheduling / coordination",
  software_development: "Software development",
  reporting: "Reporting",
  custom: "Custom",
};

const s = (n: number) => n as Scale;

function base(partial: {
  name: string;
  description: string;
  archetype: WorkflowArchetype;
  economics?: Partial<AssessmentInputs["economics"]>;
  structure?: Partial<AssessmentInputs["structure"]>;
  systems?: Partial<AssessmentInputs["systems"]>;
  risk?: Partial<AssessmentInputs["risk"]>;
  humanLoop?: Partial<AssessmentInputs["humanLoop"]>;
  workflow?: AssessmentInputs["workflow"];
  inventory?: AssessmentInputs["inventory"];
}): AssessmentInputs {
  return {
    name: partial.name,
    description: partial.description,
    archetype: partial.archetype,
    economics: {
      volume: 80,
      volumePeriod: "week",
      minutesPerCase: 20,
      peopleInvolved: 3,
      loadedHourlyCost: 85,
      variability: s(3),
      ...partial.economics,
    },
    structure: {
      ruleClarity: s(3),
      inputStructure: s(3),
      contextBreadth: s(3),
      exceptionRate: s(3),
      ...partial.structure,
    },
    systems: {
      systemAccess: s(3),
      toolingReadiness: s(3),
      permissionComplexity: s(3),
      observability: s(3),
      verification: s(3),
      ...partial.systems,
    },
    risk: {
      reversibility: s(3),
      failureConsequence: s(3),
      blastRadius: s(3),
      humanJudgment: s(3),
      regulatorySensitivity: s(3),
      ...partial.risk,
    },
    humanLoop: {
      reviewCost: s(3),
      approvalLatency: s(3),
      escalationAvailability: s(3),
      feedbackAvailability: s(3),
      ...partial.humanLoop,
    },
    workflow: partial.workflow ?? { steps: [] },
    inventory: partial.inventory ?? { systems: [] },
  };
}

export const EMPTY_ASSESSMENT: AssessmentInputs = base({
  name: "",
  description: "",
  archetype: "custom",
  economics: {
    volume: 40,
    volumePeriod: "week",
    minutesPerCase: 20,
    peopleInvolved: null,
    loadedHourlyCost: null,
    variability: s(3),
  },
  systems: {
    systemAccess: s(2),
    toolingReadiness: s(2),
    observability: s(2),
    verification: s(2),
  },
  risk: {
    reversibility: s(3),
    failureConsequence: s(3),
    blastRadius: s(3),
    humanJudgment: s(3),
    regulatorySensitivity: s(2),
  },
});

export const ARCHETYPE_DEFAULTS: Record<WorkflowArchetype, AssessmentInputs> = {
  operations_setup: base({
    name: "Operations setup",
    description: "Repeatable setup work across accounts or environments.",
    archetype: "operations_setup",
    economics: { volume: 150, minutesPerCase: 30, peopleInvolved: 4, loadedHourlyCost: 90, variability: s(2) },
    structure: { ruleClarity: s(5), inputStructure: s(4), contextBreadth: s(2), exceptionRate: s(2) },
    systems: { systemAccess: s(4), toolingReadiness: s(4), permissionComplexity: s(3), observability: s(3), verification: s(4) },
    risk: { reversibility: s(4), failureConsequence: s(2), blastRadius: s(2), humanJudgment: s(2), regulatorySensitivity: s(2) },
    humanLoop: { reviewCost: s(2), approvalLatency: s(2), escalationAvailability: s(4), feedbackAvailability: s(4) },
  }),
  support_triage: base({
    name: "Customer support triage",
    description: "Classify inbound cases, retrieve context, and route or draft a response.",
    archetype: "support_triage",
    economics: { volume: 400, minutesPerCase: 12, peopleInvolved: 8, loadedHourlyCost: 55, variability: s(3) },
    structure: { ruleClarity: s(4), inputStructure: s(3), contextBreadth: s(3), exceptionRate: s(3) },
    systems: { systemAccess: s(4), toolingReadiness: s(3), permissionComplexity: s(2), observability: s(3), verification: s(3) },
    risk: { reversibility: s(4), failureConsequence: s(3), blastRadius: s(2), humanJudgment: s(3), regulatorySensitivity: s(2) },
    humanLoop: { reviewCost: s(2), approvalLatency: s(3), escalationAvailability: s(4), feedbackAvailability: s(4) },
    workflow: {
      steps: [
        {
          id: "st-1",
          name: "Ingest ticket",
          actor: "system",
          action: "Normalize channel payload and attach customer id",
          systems: ["Helpdesk"],
          failureMode: "Wrong customer linked",
          reversible: true,
        },
        {
          id: "st-2",
          name: "Retrieve context",
          actor: "either",
          action: "Pull order, entitlement, and prior cases",
          systems: ["CRM", "Billing"],
          failureMode: "Stale or incomplete context",
          reversible: true,
        },
        {
          id: "st-3",
          name: "Classify and draft",
          actor: "system",
          action: "Propose intent label and response draft",
          systems: ["Helpdesk"],
          failureMode: "Mis-routed or tone-unsafe draft",
          reversible: true,
        },
        {
          id: "st-4",
          name: "Human send / escalate",
          actor: "human",
          action: "Approve send or escalate to specialist",
          systems: ["Helpdesk"],
          failureMode: "Agent sends without review",
          reversible: false,
        },
      ],
    },
    inventory: {
      systems: [
        { id: "sys-help", name: "Helpdesk", access: "write", criticality: s(3), notes: "Ticket updates and public replies" },
        { id: "sys-crm", name: "CRM", access: "read", criticality: s(3), notes: "Account history" },
        { id: "sys-bill", name: "Billing", access: "read", criticality: s(4), notes: "Entitlements and invoices" },
      ],
    },
  }),
  payment_exception: base({
    name: "Payment exception investigation",
    description: "Investigate failed or unmatched payments and propose a resolution.",
    archetype: "payment_exception",
    economics: { volume: 60, minutesPerCase: 45, peopleInvolved: 5, loadedHourlyCost: 110, variability: s(3) },
    structure: { ruleClarity: s(3), inputStructure: s(4), contextBreadth: s(4), exceptionRate: s(3) },
    systems: { systemAccess: s(4), toolingReadiness: s(4), permissionComplexity: s(4), observability: s(3), verification: s(3) },
    risk: { reversibility: s(2), failureConsequence: s(5), blastRadius: s(4), humanJudgment: s(3), regulatorySensitivity: s(4) },
    humanLoop: { reviewCost: s(3), approvalLatency: s(3), escalationAvailability: s(3), feedbackAvailability: s(3) },
    workflow: {
      steps: [
        {
          id: "pe-1",
          name: "Detect exception",
          actor: "system",
          action: "Flag failed / unmatched payment event",
          systems: ["Payments ledger"],
          failureMode: "False positive exception",
          reversible: true,
        },
        {
          id: "pe-2",
          name: "Gather evidence",
          actor: "either",
          action: "Pull bank file, invoice, and prior adjustments",
          systems: ["Payments ledger", "ERP", "Bank file store"],
          failureMode: "Missing remittance advice",
          reversible: true,
        },
        {
          id: "pe-3",
          name: "Propose resolution",
          actor: "system",
          action: "Draft match, retry, or write-off recommendation",
          systems: ["Payments ledger"],
          failureMode: "Incorrect match recommendation",
          reversible: true,
        },
        {
          id: "pe-4",
          name: "Post adjustment",
          actor: "human",
          action: "Approve and post ledger adjustment",
          systems: ["ERP"],
          failureMode: "Wrong amount posted",
          reversible: false,
        },
      ],
    },
    inventory: {
      systems: [
        { id: "sys-pay", name: "Payments ledger", access: "read", criticality: s(5), notes: "Source of exception events" },
        { id: "sys-erp", name: "ERP", access: "write", criticality: s(5), notes: "Adjustments require dual control" },
        { id: "sys-bank", name: "Bank file store", access: "read", criticality: s(4), notes: "Settlement files" },
      ],
    },
  }),
  document_review: base({
    name: "Document review",
    description: "Read incoming documents, extract fields, and flag issues.",
    archetype: "document_review",
    economics: { volume: 90, minutesPerCase: 25, peopleInvolved: 3, loadedHourlyCost: 95, variability: s(3) },
    structure: { ruleClarity: s(3), inputStructure: s(2), contextBreadth: s(3), exceptionRate: s(3) },
    systems: { systemAccess: s(3), toolingReadiness: s(3), permissionComplexity: s(2), observability: s(2), verification: s(3) },
    risk: { reversibility: s(4), failureConsequence: s(3), blastRadius: s(2), humanJudgment: s(3), regulatorySensitivity: s(3) },
    humanLoop: { reviewCost: s(3), approvalLatency: s(2), escalationAvailability: s(3), feedbackAvailability: s(3) },
  }),
  reconciliation: base({
    name: "Month-end reconciliation",
    description: "Match ledgers, explain breaks, and propose adjustments.",
    archetype: "reconciliation",
    economics: { volume: 20, volumePeriod: "month", minutesPerCase: 80, peopleInvolved: 4, loadedHourlyCost: 120, variability: s(3) },
    structure: { ruleClarity: s(4), inputStructure: s(4), contextBreadth: s(4), exceptionRate: s(3) },
    systems: { systemAccess: s(4), toolingReadiness: s(3), permissionComplexity: s(3), observability: s(3), verification: s(4) },
    risk: { reversibility: s(3), failureConsequence: s(4), blastRadius: s(3), humanJudgment: s(3), regulatorySensitivity: s(3) },
    humanLoop: { reviewCost: s(3), approvalLatency: s(3), escalationAvailability: s(3), feedbackAvailability: s(4) },
  }),
  research: base({
    name: "Internal research",
    description: "Assemble sources, compare options, and draft a recommendation.",
    archetype: "research",
    economics: { volume: 12, minutesPerCase: 90, peopleInvolved: 2, loadedHourlyCost: 130, variability: s(4) },
    structure: { ruleClarity: s(2), inputStructure: s(2), contextBreadth: s(5), exceptionRate: s(3) },
    systems: { systemAccess: s(4), toolingReadiness: s(3), permissionComplexity: s(2), observability: s(2), verification: s(2) },
    risk: { reversibility: s(5), failureConsequence: s(2), blastRadius: s(1), humanJudgment: s(4), regulatorySensitivity: s(1) },
    humanLoop: { reviewCost: s(3), approvalLatency: s(2), escalationAvailability: s(4), feedbackAvailability: s(3) },
    workflow: {
      steps: [
        {
          id: "rs-1",
          name: "Frame question",
          actor: "human",
          action: "Define decision criteria and scope",
          systems: ["Brief doc"],
          failureMode: "Ambiguous success criteria",
          reversible: true,
        },
        {
          id: "rs-2",
          name: "Gather sources",
          actor: "either",
          action: "Collect docs, tickets, and prior memos",
          systems: ["Wiki", "Drive"],
          failureMode: "Stale or incomplete corpus",
          reversible: true,
        },
        {
          id: "rs-3",
          name: "Synthesize options",
          actor: "system",
          action: "Draft comparison with citations",
          systems: ["Brief doc"],
          failureMode: "Hallucinated citation",
          reversible: true,
        },
        {
          id: "rs-4",
          name: "Human recommendation",
          actor: "human",
          action: "Select option and own the call",
          systems: ["Brief doc"],
          failureMode: "Rubber-stamp without reading",
          reversible: true,
        },
      ],
    },
    inventory: {
      systems: [
        { id: "sys-wiki", name: "Wiki", access: "read", criticality: s(3), notes: "Internal knowledge" },
        { id: "sys-drive", name: "Drive", access: "read", criticality: s(3), notes: "Source packets" },
        { id: "sys-brief", name: "Brief doc", access: "write", criticality: s(2), notes: "Draft output" },
      ],
    },
  }),
  data_analysis: base({
    name: "Data analysis",
    description: "Query, join, and interpret datasets for an operating question.",
    archetype: "data_analysis",
    economics: { volume: 20, minutesPerCase: 50, peopleInvolved: 2, loadedHourlyCost: 125, variability: s(4) },
    structure: { ruleClarity: s(3), inputStructure: s(4), contextBreadth: s(4), exceptionRate: s(3) },
    systems: { systemAccess: s(4), toolingReadiness: s(4), permissionComplexity: s(3), observability: s(3), verification: s(3) },
    risk: { reversibility: s(4), failureConsequence: s(3), blastRadius: s(2), humanJudgment: s(3), regulatorySensitivity: s(2) },
    humanLoop: { reviewCost: s(3), approvalLatency: s(2), escalationAvailability: s(3), feedbackAvailability: s(3) },
  }),
  client_onboarding: base({
    name: "Client onboarding review",
    description: "Collect KYC/onboarding packets, check completeness, and advance the case.",
    archetype: "client_onboarding",
    economics: { volume: 35, minutesPerCase: 40, peopleInvolved: 4, loadedHourlyCost: 95, variability: s(3) },
    structure: { ruleClarity: s(4), inputStructure: s(3), contextBreadth: s(4), exceptionRate: s(3) },
    systems: { systemAccess: s(3), toolingReadiness: s(3), permissionComplexity: s(3), observability: s(3), verification: s(3) },
    risk: { reversibility: s(3), failureConsequence: s(4), blastRadius: s(3), humanJudgment: s(3), regulatorySensitivity: s(4) },
    humanLoop: { reviewCost: s(3), approvalLatency: s(3), escalationAvailability: s(3), feedbackAvailability: s(3) },
  }),
  compliance_review: base({
    name: "Regulatory sign-off",
    description: "Review a packet against policy and record an accountable decision.",
    archetype: "compliance_review",
    economics: { volume: 18, minutesPerCase: 55, peopleInvolved: 3, loadedHourlyCost: 140, variability: s(3) },
    structure: { ruleClarity: s(2), inputStructure: s(3), contextBreadth: s(4), exceptionRate: s(3) },
    systems: { systemAccess: s(3), toolingReadiness: s(2), permissionComplexity: s(4), observability: s(3), verification: s(2) },
    risk: { reversibility: s(2), failureConsequence: s(5), blastRadius: s(4), humanJudgment: s(5), regulatorySensitivity: s(5) },
    humanLoop: { reviewCost: s(4), approvalLatency: s(3), escalationAvailability: s(3), feedbackAvailability: s(2) },
    workflow: {
      steps: [
        {
          id: "cr-1",
          name: "Receive packet",
          actor: "system",
          action: "Ingest submission and checklist",
          systems: ["Case system"],
          failureMode: "Incomplete packet accepted",
          reversible: true,
        },
        {
          id: "cr-2",
          name: "Policy check",
          actor: "either",
          action: "Compare packet to current policy rules",
          systems: ["Policy library", "Case system"],
          failureMode: "Outdated rule applied",
          reversible: true,
        },
        {
          id: "cr-3",
          name: "Flag exceptions",
          actor: "system",
          action: "List gaps and residual risk",
          systems: ["Case system"],
          failureMode: "Missed material exception",
          reversible: true,
        },
        {
          id: "cr-4",
          name: "Accountable sign-off",
          actor: "human",
          action: "Record approve / reject with rationale",
          systems: ["Case system"],
          failureMode: "Unsigned production path",
          reversible: false,
        },
      ],
    },
    inventory: {
      systems: [
        { id: "sys-case", name: "Case system", access: "write", criticality: s(5), notes: "Decision record of truth" },
        { id: "sys-pol", name: "Policy library", access: "read", criticality: s(5), notes: "Current rules" },
      ],
    },
  }),
  internal_approval: base({
    name: "Internal approval",
    description: "Route a request, assemble evidence, and record a decision.",
    archetype: "internal_approval",
    economics: { volume: 50, minutesPerCase: 18, peopleInvolved: 6, loadedHourlyCost: 100, variability: s(2) },
    structure: { ruleClarity: s(4), inputStructure: s(4), contextBreadth: s(2), exceptionRate: s(2) },
    systems: { systemAccess: s(3), toolingReadiness: s(3), permissionComplexity: s(4), observability: s(3), verification: s(4) },
    risk: { reversibility: s(3), failureConsequence: s(3), blastRadius: s(2), humanJudgment: s(3), regulatorySensitivity: s(2) },
    humanLoop: { reviewCost: s(3), approvalLatency: s(4), escalationAvailability: s(3), feedbackAvailability: s(3) },
    workflow: {
      steps: [
        {
          id: "ia-1",
          name: "Intake request",
          actor: "system",
          action: "Capture request form and requester",
          systems: ["Approval portal"],
          failureMode: "Missing required fields",
          reversible: true,
        },
        {
          id: "ia-2",
          name: "Assemble evidence",
          actor: "either",
          action: "Attach policy, spend, and prior decisions",
          systems: ["ERP", "Wiki"],
          failureMode: "Wrong policy version",
          reversible: true,
        },
        {
          id: "ia-3",
          name: "Route approver",
          actor: "system",
          action: "Select approver chain by amount and type",
          systems: ["Approval portal"],
          failureMode: "Mis-routed approver",
          reversible: true,
        },
        {
          id: "ia-4",
          name: "Record decision",
          actor: "human",
          action: "Approve, reject, or request changes",
          systems: ["Approval portal"],
          failureMode: "Decision without evidence review",
          reversible: false,
        },
      ],
    },
    inventory: {
      systems: [
        { id: "sys-appr", name: "Approval portal", access: "write", criticality: s(4), notes: "Decision record" },
        { id: "sys-erp2", name: "ERP", access: "read", criticality: s(4), notes: "Spend context" },
        { id: "sys-wiki2", name: "Wiki", access: "read", criticality: s(2), notes: "Policy" },
      ],
    },
  }),
  monitoring: base({
    name: "Monitoring",
    description: "Watch streams or queues, detect anomalies, and open a case.",
    archetype: "monitoring",
    economics: { volume: 200, minutesPerCase: 8, peopleInvolved: 3, loadedHourlyCost: 90, variability: s(3) },
    structure: { ruleClarity: s(4), inputStructure: s(4), contextBreadth: s(3), exceptionRate: s(3) },
    systems: { systemAccess: s(5), toolingReadiness: s(4), permissionComplexity: s(3), observability: s(4), verification: s(4) },
    risk: { reversibility: s(4), failureConsequence: s(3), blastRadius: s(3), humanJudgment: s(2), regulatorySensitivity: s(2) },
    humanLoop: { reviewCost: s(2), approvalLatency: s(3), escalationAvailability: s(4), feedbackAvailability: s(4) },
  }),
  scheduling: base({
    name: "Scheduling / coordination",
    description: "Match people, times, and constraints, then confirm.",
    archetype: "scheduling",
    economics: { volume: 70, minutesPerCase: 15, peopleInvolved: 2, loadedHourlyCost: 70, variability: s(3) },
    structure: { ruleClarity: s(4), inputStructure: s(4), contextBreadth: s(2), exceptionRate: s(3) },
    systems: { systemAccess: s(3), toolingReadiness: s(3), permissionComplexity: s(1), observability: s(2), verification: s(4) },
    risk: { reversibility: s(4), failureConsequence: s(2), blastRadius: s(1), humanJudgment: s(2), regulatorySensitivity: s(1) },
    humanLoop: { reviewCost: s(2), approvalLatency: s(3), escalationAvailability: s(3), feedbackAvailability: s(3) },
  }),
  software_development: base({
    name: "Software development",
    description: "Implement a well-specified change with tests and review.",
    archetype: "software_development",
    economics: { volume: 15, minutesPerCase: 120, peopleInvolved: 4, loadedHourlyCost: 150, variability: s(4) },
    structure: { ruleClarity: s(3), inputStructure: s(3), contextBreadth: s(5), exceptionRate: s(3) },
    systems: { systemAccess: s(5), toolingReadiness: s(5), permissionComplexity: s(3), observability: s(4), verification: s(4) },
    risk: { reversibility: s(4), failureConsequence: s(3), blastRadius: s(3), humanJudgment: s(4), regulatorySensitivity: s(2) },
    humanLoop: { reviewCost: s(3), approvalLatency: s(2), escalationAvailability: s(4), feedbackAvailability: s(5) },
  }),
  reporting: base({
    name: "Reporting",
    description: "Assemble a recurring report from known systems.",
    archetype: "reporting",
    economics: { volume: 8, volumePeriod: "week", minutesPerCase: 60, peopleInvolved: 2, loadedHourlyCost: 95, variability: s(2) },
    structure: { ruleClarity: s(5), inputStructure: s(5), contextBreadth: s(2), exceptionRate: s(1) },
    systems: { systemAccess: s(4), toolingReadiness: s(4), permissionComplexity: s(2), observability: s(3), verification: s(5) },
    risk: { reversibility: s(5), failureConsequence: s(2), blastRadius: s(2), humanJudgment: s(1), regulatorySensitivity: s(2) },
    humanLoop: { reviewCost: s(2), approvalLatency: s(2), escalationAvailability: s(3), feedbackAvailability: s(4) },
  }),
  custom: EMPTY_ASSESSMENT,
};

export const EXAMPLE_KEYS = [
  "support_triage",
  "payment_exception",
  "research",
  "internal_approval",
  "compliance_review",
] as const satisfies WorkflowArchetype[];

export function cloneInputs(inputs: AssessmentInputs): AssessmentInputs {
  return structuredClone(inputs);
}

export function applyArchetype(archetype: WorkflowArchetype, currentName: string): AssessmentInputs {
  const preset = cloneInputs(ARCHETYPE_DEFAULTS[archetype]);
  if (archetype === "custom") {
    return { ...cloneInputs(EMPTY_ASSESSMENT), name: currentName };
  }
  const presetNames = new Set(Object.values(ARCHETYPE_DEFAULTS).map((a) => a.name));
  if (currentName.trim() && !presetNames.has(currentName)) {
    preset.name = currentName;
  }
  return preset;
}
