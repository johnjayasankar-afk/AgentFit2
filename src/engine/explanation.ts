import { AUTONOMY_LABELS } from "./autonomy";
import { weeklyCases, weeklyManualHours } from "./normalize";
import type {
  AssessmentInputs,
  AutonomyLevel,
  Explanation,
  PathStep,
  ScoreBreakdown,
  SystemPattern,
} from "@/domain/types";

export function explainRecommendation(
  inputs: AssessmentInputs,
  score: ScoreBreakdown,
  autonomy: AutonomyLevel,
  pattern: SystemPattern,
): Explanation {
  const strong: string[] = [];
  const limits: string[] = [];
  const cases = weeklyCases(inputs.economics);
  const hours = weeklyManualHours(inputs.economics);

  if (cases >= 40) {
    strong.push(`${fmt(cases)} cases / week`);
  }
  if (inputs.economics.minutesPerCase >= 15) {
    strong.push(`${inputs.economics.minutesPerCase} minutes per case`);
  }
  if (hours >= 10) {
    strong.push(`${fmt(hours)} manual hours / week`);
  }
  if (inputs.structure.ruleClarity >= 4) strong.push("clear operating rules");
  if (inputs.structure.inputStructure >= 4) strong.push("structured inputs");
  if (inputs.systems.systemAccess >= 4) strong.push("strong programmatic data access");
  if (inputs.systems.toolingReadiness >= 4) strong.push("stable typed interfaces");
  if (inputs.risk.reversibility >= 4) strong.push("actions are reversible");
  if (inputs.systems.verification >= 4) strong.push("cheap, deterministic verification");
  if (inputs.humanLoop.feedbackAvailability >= 4) strong.push("outcomes can be observed and fed back");

  if (inputs.risk.failureConsequence >= 4) {
    limits.push("outcomes carry meaningful financial, legal, or customer consequence");
  }
  if (inputs.risk.blastRadius >= 4) limits.push("a single miss can travel beyond one record");
  if (inputs.risk.reversibility <= 2) limits.push("actions are difficult or expensive to reverse");
  if (inputs.systems.verification <= 2) limits.push("output is not cheap to verify");
  if (inputs.structure.exceptionRate >= 4) limits.push("exceptions are common");
  if (inputs.risk.humanJudgment >= 4) limits.push("expert judgment remains central");
  if (inputs.risk.regulatorySensitivity >= 4) limits.push("policy or regulatory constraint is high");
  if (inputs.systems.permissionComplexity >= 4) limits.push("permission scope is privileged or complex");
  if (inputs.systems.systemAccess <= 2) limits.push("system access is still mostly manual");
  if (inputs.humanLoop.escalationAvailability <= 2) {
    limits.push("an informed human may not be available when the case goes sideways");
  }
  if (inputs.humanLoop.approvalLatency >= 4 && autonomy >= 3) {
    limits.push("approval latency would erase much of the workflow benefit — keep the gate narrow");
  }
  if (score.conventionalPenalty > 0) {
    limits.push("the work is regular enough that a rules engine may beat an agent");
  }
  if (cases < 8 && hours < 4) {
    limits.push("volume is low; capacity returned may not justify an agent program");
  }
  if (limits.length === 0 && inputs.risk.failureConsequence >= 3) {
    limits.push("consequence is material enough that a control gate should remain");
  }
  if (limits.length === 0 && inputs.risk.reversibility <= 3) {
    limits.push("reversal is not free; keep writes observable");
  }
  if (limits.length === 0) {
    limits.push("the assessment is still coarse — treat the output as a hypothesis");
  }

  if (strong.length === 0) {
    strong.push("enough structure exists to form a discovery hypothesis");
  }

  return {
    strongSignals: strong.slice(0, 6),
    limitingFactors: limits.slice(0, 6),
    therefore: thereforeCopy(inputs, autonomy, pattern, score),
  };
}

function thereforeCopy(
  inputs: AssessmentInputs,
  autonomy: AutonomyLevel,
  pattern: SystemPattern,
  score: ScoreBreakdown,
): string {
  const label = AUTONOMY_LABELS[autonomy];
  if (pattern === "Deterministic Automation") {
    return "Rules are explicit and inputs are structured. Conventional software captures the value without introducing a generative control plane.";
  }
  if (pattern === "Human-Led Process") {
    return "Judgment and consequence dominate. Do not agentify this yet — instrument the work and keep a human as the decision-maker.";
  }
  if (autonomy >= 4) {
    return `${label} is credible because reversibility, verification, and permission scope can contain independent execution. Keep the envelope tight.`;
  }
  if (autonomy === 3) {
    if (score.total >= 70 && (inputs.risk.failureConsequence >= 4 || inputs.risk.reversibility <= 2)) {
      return "Supervised execution captures most of the economic value without granting unnecessary autonomy.";
    }
    return "The agent can plan and use tools, but consequential writes stay behind an approval gate.";
  }
  if (autonomy === 2) {
    return "An assistive agent can research, draft, and recommend. A human still initiates or executes anything that matters.";
  }
  if (autonomy === 1) {
    return "AI can shorten interpretation. The human should continue to own the decision and the action.";
  }
  return `${label} is the posture that matches the current economics, access, and risk — not the largest model available.`;
}

export function pathToNextAutonomy(inputs: AssessmentInputs, autonomy: AutonomyLevel): PathStep[] {
  if (autonomy >= 5) {
    return [
      {
        title: "Hold the envelope",
        detail: "Full autonomy is rarely the correct enterprise default. Prove error rate, rollback, and override quality before widening scope.",
        dimension: "operating-controls",
      },
    ];
  }

  const steps: PathStep[] = [];
  const next = (autonomy + 1) as AutonomyLevel;
  const target = AUTONOMY_LABELS[next];

  const add = (ok: boolean, title: string, detail: string, dimension: string) => {
    if (!ok) steps.push({ title, detail, dimension });
  };

  if (next >= 2) {
    add(inputs.structure.ruleClarity >= 3, "Clarify operating rules", "Write the decision policy a competent new hire would follow.", "ruleClarity");
    add(inputs.systems.systemAccess >= 3, "Open programmatic access", "Replace swivel-chair retrieval with reliable read APIs.", "systemAccess");
  }
  if (next >= 3) {
    add(inputs.systems.toolingReadiness >= 3, "Stabilize typed tools", "Expose a small, documented action set instead of browser automation.", "toolingReadiness");
    add(inputs.systems.verification >= 3, "Add deterministic verification", "Check outputs with rules the model cannot rewrite.", "verification");
    add(inputs.humanLoop.escalationAvailability >= 3, "Staff exception escalation", "Name who takes the case when the machine abstains.", "escalationAvailability");
  }
  if (next >= 4) {
    add(inputs.risk.reversibility >= 4, "Make actions reversible", "Introduce rollback or compensating transactions.", "reversibility");
    add(inputs.systems.verification >= 4, "Raise verification to cheap and deterministic", "Post-action validation should be automatic.", "verification");
    add(inputs.systems.permissionComplexity <= 3, "Reduce permission scope", "Split privileged writes from the agent runtime.", "permissionComplexity");
    add(inputs.structure.exceptionRate <= 3, "Contain the exception rate", "Route messy cases out before expanding autonomy.", "exceptionRate");
    add(inputs.systems.observability >= 4, "Make every step reconstructable", "Plan, tool call, and decision must be replayable.", "observability");
    add(
      inputs.risk.failureConsequence <= 3,
      "Narrow the blast of a miss",
      "Lower consequence via limits, canaries, or a smaller case class.",
      "failureConsequence",
    );
  }
  if (next >= 5) {
    add(inputs.risk.failureConsequence <= 2, "Keep consequence low", "Autonomous systems need a miss to be cheap.", "failureConsequence");
    add(inputs.risk.blastRadius <= 2, "Bound blast radius", "One run cannot touch many customers or material capital.", "blastRadius");
    add(inputs.risk.humanJudgment <= 2, "Remove irreducible judgment", "If an expert still has to see it, it is not autonomous.", "humanJudgment");
  }

  if (steps.length === 0) {
    steps.push({
      title: `Demonstrate a clean ${target.toLowerCase()} pilot`,
      detail: "The scored dimensions already support the next rung. What is missing is operating evidence: error rate, override rate, and time-to-escalation.",
      dimension: "pilot-evidence",
    });
  }

  return steps.slice(0, 5);
}

function fmt(n: number): string {
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
}
