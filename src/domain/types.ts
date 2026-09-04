export const MODEL_VERSION = "1.0" as const;
export const MODEL_LABEL = "AgentFit Model 1.0";

export type ModelVersion = typeof MODEL_VERSION;

export type VolumePeriod = "day" | "week" | "month";

export type WorkflowArchetype =
  | "operations_setup"
  | "support_triage"
  | "payment_exception"
  | "document_review"
  | "reconciliation"
  | "research"
  | "data_analysis"
  | "client_onboarding"
  | "compliance_review"
  | "internal_approval"
  | "monitoring"
  | "scheduling"
  | "software_development"
  | "reporting"
  | "custom";

export type Scale = 1 | 2 | 3 | 4 | 5;

export type DimensionPolarity = "raises" | "constrains" | "mixed";

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type AutonomyLabel =
  | "Conventional Software"
  | "Copilot"
  | "Assistive Agent"
  | "Supervised Agent"
  | "Bounded Agent"
  | "Autonomous System";

export type SystemPattern =
  | "Human-Led Process"
  | "Deterministic Automation"
  | "AI Assist"
  | "Retrieval + Assist"
  | "Tool-Using Assistant"
  | "Supervised Tool Agent"
  | "Bounded Execution Agent"
  | "Multi-Agent Orchestration";

export type ReadinessLevel =
  | "Not Ready"
  | "Discovery Ready"
  | "Pilot Ready"
  | "Production Candidate";

export type ConfidenceLevel = "Low" | "Medium" | "High";

export type PortfolioClass =
  | "Build Now"
  | "De-risk First"
  | "Assist, Don't Agentify"
  | "Automate Conventionally"
  | "Low Priority";

export type ControlId =
  | "human_approval"
  | "read_only_tools"
  | "typed_actions"
  | "allowlisted_tools"
  | "transaction_limits"
  | "rate_limits"
  | "confidence_threshold"
  | "deterministic_validation"
  | "schema_validation"
  | "pre_action_simulation"
  | "dual_approval"
  | "audit_log"
  | "rollback"
  | "timeout"
  | "restricted_data_access"
  | "exception_escalation"
  | "sandbox_execution"
  | "idempotency"
  | "reconciliation"
  | "monitoring";

export interface ControlPrimitive {
  id: ControlId;
  label: string;
  rationale: string;
}

export interface EconomicsInputs {
  volume: number;
  volumePeriod: VolumePeriod;
  minutesPerCase: number;
  peopleInvolved: number | null;
  loadedHourlyCost: number | null;
  variability: Scale;
}

export interface StructureInputs {
  ruleClarity: Scale;
  inputStructure: Scale;
  contextBreadth: Scale;
  exceptionRate: Scale;
}

export interface SystemInputs {
  systemAccess: Scale;
  toolingReadiness: Scale;
  permissionComplexity: Scale;
  observability: Scale;
  verification: Scale;
}

export interface RiskInputs {
  reversibility: Scale;
  failureConsequence: Scale;
  blastRadius: Scale;
  humanJudgment: Scale;
  regulatorySensitivity: Scale;
}

export interface HumanLoopInputs {
  reviewCost: Scale;
  approvalLatency: Scale;
  escalationAvailability: Scale;
  feedbackAvailability: Scale;
}

export type WorkflowActor = "human" | "system" | "either";

export interface WorkflowStep {
  id: string;
  name: string;
  actor: WorkflowActor;
  action: string;
  systems: string[];
  failureMode: string;
  reversible: boolean;
}

export interface WorkflowMap {
  steps: WorkflowStep[];
}

export type SystemAccessLevel = "none" | "read" | "write" | "admin";

export interface SystemAsset {
  id: string;
  name: string;
  access: SystemAccessLevel;
  criticality: Scale;
  notes: string;
}

export interface SystemsInventory {
  systems: SystemAsset[];
}

export interface AssessmentInputs {
  name: string;
  description: string;
  archetype: WorkflowArchetype;
  economics: EconomicsInputs;
  structure: StructureInputs;
  systems: SystemInputs;
  risk: RiskInputs;
  humanLoop: HumanLoopInputs;
  /** Explicit process map — turns the assessment from scales into a designed workflow. */
  workflow: WorkflowMap;
  /** Named systems the agent would touch. Complements scalar system readiness. */
  inventory: SystemsInventory;
}

export interface EconomicAssumptions {
  coverage: number;
  timeReduction: number;
  reviewMinutesPerCase: number;
}

export interface ScoreBreakdown {
  economicOpportunity: number;
  workflowStructure: number;
  technicalReadiness: number;
  controllability: number;
  riskSuitability: number;
  humanJudgmentSuitability: number;
  conventionalPenalty: number;
  total: number;
}

export interface CapacityModel {
  weeklyCases: number;
  monthlyCases: number;
  manualHoursWeek: number;
  manualHoursMonth: number;
  potentialAutomatedHours: number;
  reviewHours: number;
  netCapacityReturned: number;
  monthlyLaborCost: number | null;
  annualLaborCost: number | null;
  annualCapacityValue: number | null;
  coverageUsed: number;
  timeReductionUsed: number;
  reviewMinutesUsed: number;
}

export interface Explanation {
  strongSignals: string[];
  limitingFactors: string[];
  therefore: string;
}

export interface PathStep {
  title: string;
  detail: string;
  dimension: string;
}

export interface NextExperiment {
  title: string;
  rationale: string;
  successCriteria: string[];
}

export interface PilotDesign {
  scope: string;
  userGroup: string;
  allowedActions: string[];
  disallowedActions: string[];
  approvalBoundary: string;
  fallbackBehavior: string;
  loggingRequirement: string;
  evaluationMetrics: string[];
  exitCriteria: string[];
}

export interface EvalMetric {
  id: string;
  label: string;
  why: string;
}

export interface RiskItem {
  id: string;
  risk: string;
  why: string;
  severity: 1 | 2 | 3 | 4 | 5;
  mitigation: string;
}

export interface FmeaItem {
  id: string;
  failure: string;
  cause: string;
  effect: string;
  severity: 1 | 2 | 3 | 4 | 5;
  occurrence: 1 | 2 | 3 | 4 | 5;
  detection: 1 | 2 | 3 | 4 | 5;
  rpn: number;
  mitigation: string;
  source: "workflow" | "risk" | "system";
}

export type GateStatus = "pass" | "warn" | "fail" | "unknown";

export interface GoNoGoGate {
  id: string;
  label: string;
  status: GateStatus;
  detail: string;
  category: "fit" | "autonomy" | "readiness" | "controls" | "design" | "economics";
  /** One-line control-loop hint shown on fail/warn. */
  fixHint?: string;
  /** Left-pane or result-tab target for the fix path. */
  fixTarget?: "map" | "inventory" | "economics" | "diagnosis" | "design" | "risks" | "recommend";
}

export interface DesignSummary {
  stepCount: number;
  systemCount: number;
  writeSystemCount: number;
  irreversibleSteps: number;
  humanOnlySteps: number;
  mappedCompleteness: number;
}

export interface ArchitectureNode {
  id: string;
  label: string;
}

export interface SensitivityRow {
  key: string;
  label: string;
  fitDelta: number;
  autonomyDelta: number;
  leverage: "high" | "medium" | "low";
}

export interface AutonomyBlocker {
  id: string;
  title: string;
  detail: string;
}

export interface EvaluationResult {
  modelVersion: ModelVersion;
  modelLabel: string;
  score: number;
  breakdown: ScoreBreakdown;
  autonomy: AutonomyLevel;
  autonomyLabel: AutonomyLabel;
  pattern: SystemPattern;
  controlPosture: string;
  controlsRequired: ControlPrimitive[];
  controlsBeforeAutonomyIncrease: ControlPrimitive[];
  readiness: ReadinessLevel;
  readinessNote: string;
  confidence: ConfidenceLevel;
  confidenceReasons: string[];
  capacity: CapacityModel;
  explanation: Explanation;
  pathToNextAutonomy: PathStep[];
  experiment: NextExperiment;
  pilot: PilotDesign;
  evaluationPlan: EvalMetric[];
  risks: RiskItem[];
  fmea: FmeaItem[];
  goNoGo: GoNoGoGate[];
  design: DesignSummary;
  architecture: ArchitectureNode[];
  conventionalAffinity: number;
  blockers: AutonomyBlocker[];
  portfolioClass: PortfolioClass;
  completeness: number;
  verdict: string;
  field: {
    x: number;
    y: number;
    zone: "assist" | "supervised" | "bounded";
  };
}

export interface AssessmentRecord {
  id: string;
  modelVersion: ModelVersion;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  demo: boolean;
  notes: string;
  inputs: AssessmentInputs;
  assumptions: EconomicAssumptions;
  result: EvaluationResult;
  scenarioInputs: AssessmentInputs | null;
  editedSuccessCriteria: string[] | null;
  editedRisks: RiskItem[] | null;
  editedFmea: FmeaItem[] | null;
  editedPilot: PilotDesign | null;
}

export interface WorkspaceBackup {
  kind: "agentfit.workspace";
  version: 1;
  exportedAt: string;
  modelVersion: ModelVersion;
  assessments: AssessmentRecord[];
}

export interface AssessmentExport {
  kind: "agentfit.assessment";
  version: 1;
  exportedAt: string;
  assessment: AssessmentRecord;
}

export type AppView =
  | "welcome"
  | "assess"
  | "library"
  | "compare"
  | "matrix"
  | "methodology"
  | "settings";

export type ResultTab =
  | "recommendation"
  | "design"
  | "scenario"
  | "sensitivity"
  | "pilot"
  | "risks"
  | "gates"
  | "brief";
