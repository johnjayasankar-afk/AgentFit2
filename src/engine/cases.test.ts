import { describe, expect, it } from "vitest";
import { ARCHETYPE_DEFAULTS } from "@/data/presets";
import type { AssessmentInputs, Scale } from "@/domain/types";
import { recommendAutonomy } from "./autonomy";
import { classifyPortfolio } from "./compare";
import { calculateCapacity } from "./economics";
import { evaluate } from "./evaluate";
import { weeklyManualHours } from "./normalize";
import { recommendPattern } from "./recommendation";
import { conventionalAffinity, scoreFit } from "./score";
import { analyzeSensitivity } from "./sensitivity";

const s = (n: number) => n as Scale;

function merge(base: AssessmentInputs, patch: DeepPartial<AssessmentInputs>): AssessmentInputs {
  return {
    ...base,
    ...patch,
    economics: { ...base.economics, ...patch.economics },
    structure: { ...base.structure, ...patch.structure },
    systems: { ...base.systems, ...patch.systems },
    risk: { ...base.risk, ...patch.risk },
    humanLoop: { ...base.humanLoop, ...patch.humanLoop },
    workflow: base.workflow,
    inventory: base.inventory,
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const blank: AssessmentInputs = ARCHETYPE_DEFAULTS.custom;

describe("Case A — high volume, access, reversibility, low consequence", () => {
  const inputs = merge(blank, {
    name: "Case A",
    economics: { volume: 180, volumePeriod: "week", minutesPerCase: 25, variability: s(2) },
    structure: { ruleClarity: s(4), inputStructure: s(4), contextBreadth: s(3), exceptionRate: s(2) },
    systems: {
      systemAccess: s(5),
      toolingReadiness: s(5),
      permissionComplexity: s(2),
      observability: s(4),
      verification: s(4),
    },
    risk: {
      reversibility: s(5),
      failureConsequence: s(2),
      blastRadius: s(2),
      humanJudgment: s(2),
      regulatorySensitivity: s(2),
    },
    humanLoop: {
      reviewCost: s(2),
      approvalLatency: s(2),
      escalationAvailability: s(4),
      feedbackAvailability: s(4),
    },
  });

  it("scores high fit and allows higher autonomy", () => {
    const result = evaluate(inputs);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.autonomy).toBeGreaterThanOrEqual(3);
    expect(result.pattern).not.toBe("Human-Led Process");
  });
});

describe("Case B — high volume and access, low reversibility, high consequence", () => {
  const inputs = merge(ARCHETYPE_DEFAULTS.payment_exception, { name: "Case B" });

  it("keeps high fit but supervised-or-lower autonomy", () => {
    const result = evaluate(inputs);
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.autonomy).toBeLessThanOrEqual(3);
    expect(result.autonomy).toBeGreaterThanOrEqual(2);
    expect(result.controlPosture.toLowerCase()).toMatch(/approval|human/);
    expect(result.score).toBeGreaterThan(result.autonomy * 15);
  });

  it("does not treat a high score as a license for autonomy", () => {
    const fit = scoreFit(inputs).total;
    const autonomy = recommendAutonomy(inputs);
    expect(fit).toBeGreaterThan(50);
    expect(autonomy).toBeLessThan(4);
  });
});

describe("Case C — low volume, deterministic, structured", () => {
  const inputs = merge(ARCHETYPE_DEFAULTS.reporting, {
    name: "Case C",
    economics: { volume: 4, volumePeriod: "week", minutesPerCase: 20, variability: s(1) },
  });

  it("prefers conventional automation over an agent", () => {
    const result = evaluate(inputs);
    expect(conventionalAffinity(inputs)).toBeGreaterThan(0.8);
    expect(result.autonomy).toBe(0);
    expect(result.pattern).toBe("Deterministic Automation");
    expect(classifyPortfolio(result)).toBe("Automate Conventionally");
  });
});

describe("Case D — low rule clarity, expert judgment, high consequence", () => {
  const inputs = merge(ARCHETYPE_DEFAULTS.compliance_review, { name: "Case D" });

  it("stays human-led or assistive", () => {
    const result = evaluate(inputs);
    expect(result.autonomy).toBeLessThanOrEqual(2);
    expect(["Human-Led Process", "AI Assist", "Retrieval + Assist"]).toContain(result.pattern);
    expect(result.explanation.limitingFactors.length).toBeGreaterThan(0);
  });
});

describe("economic model", () => {
  it("computes weekly hours from period-normalized volume", () => {
    const daily = merge(blank, {
      economics: { volume: 10, volumePeriod: "day", minutesPerCase: 60 },
    });
    expect(weeklyManualHours(daily.economics)).toBe(50);
  });

  it("returns capacity without requiring loaded cost", () => {
    const inputs = merge(ARCHETYPE_DEFAULTS.support_triage, {
      economics: { loadedHourlyCost: null },
    });
    const cap = calculateCapacity(inputs, 2);
    expect(cap.netCapacityReturned).toBeGreaterThan(0);
    expect(cap.annualLaborCost).toBeNull();
    expect(cap.annualCapacityValue).toBeNull();
  });

  it("changes capacity when autonomy assumptions change", () => {
    const inputs = ARCHETYPE_DEFAULTS.support_triage;
    const copilot = calculateCapacity(inputs, 1);
    const supervised = calculateCapacity(inputs, 3);
    expect(supervised.netCapacityReturned).toBeGreaterThan(copilot.netCapacityReturned);
  });
});

describe("sensitivity", () => {
  it("ranks verification as high leverage when it is the constraint", () => {
    const inputs = merge(ARCHETYPE_DEFAULTS.payment_exception, {
      systems: { verification: s(2) },
    });
    const rows = analyzeSensitivity(inputs);
    const verification = rows.find((r) => r.key === "verification");
    expect(verification).toBeTruthy();
    expect(["high", "medium"]).toContain(verification?.leverage);
  });
});

describe("scenario movement", () => {
  it("improves fit when access, verification, and reversibility rise", () => {
    const current = ARCHETYPE_DEFAULTS.payment_exception;
    const scenario = merge(current, {
      systems: { systemAccess: s(5), verification: s(5) },
      risk: { reversibility: s(4) },
    });
    expect(evaluate(scenario).score).toBeGreaterThan(evaluate(current).score);
  });
});

describe("presets encode the thesis", () => {
  it("does not recommend agents for everything", () => {
    const reporting = evaluate(ARCHETYPE_DEFAULTS.reporting);
    const compliance = evaluate(ARCHETYPE_DEFAULTS.compliance_review);
    const payment = evaluate(ARCHETYPE_DEFAULTS.payment_exception);
    const support = evaluate(ARCHETYPE_DEFAULTS.support_triage);
    const research = evaluate(ARCHETYPE_DEFAULTS.research);

    expect(reporting.pattern).toBe("Deterministic Automation");
    expect(compliance.autonomy).toBeLessThanOrEqual(2);
    expect(payment.autonomy).toBeLessThanOrEqual(3);
    expect(support.autonomy).toBeGreaterThanOrEqual(2);
    expect(research.autonomy).toBeLessThanOrEqual(3);
    expect(research.score).toBeGreaterThan(40);
    expect(classifyPortfolio(payment)).toBe("De-risk First");
    expect(classifyPortfolio(reporting)).toBe("Automate Conventionally");
  });

  it("keeps pattern recommendations conservative about multi-agent", () => {
    expect(recommendPattern(ARCHETYPE_DEFAULTS.support_triage, 3)).not.toBe("Multi-Agent Orchestration");
    expect(recommendPattern(ARCHETYPE_DEFAULTS.payment_exception, 3)).not.toBe("Multi-Agent Orchestration");
  });
});

describe("blank assessment stays conservative", () => {
  it("does not recommend supervised execution from empty starting values", () => {
    const result = evaluate(ARCHETYPE_DEFAULTS.custom);
    expect(result.autonomy).toBeLessThanOrEqual(2);
  });
});

describe("readiness is not authorization", () => {
  it("never implies production authorization in copy", () => {
    const result = evaluate(ARCHETYPE_DEFAULTS.operations_setup);
    if (result.readiness === "Production Candidate") {
      expect(result.readinessNote.toLowerCase()).toContain("does not authorize");
    }
  });
});
