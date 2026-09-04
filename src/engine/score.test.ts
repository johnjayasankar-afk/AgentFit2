import { describe, expect, it } from "vitest";
import { ARCHETYPE_DEFAULTS } from "@/data/presets";
import { SCORE_WEIGHTS } from "@/domain/model";
import { scoreFit } from "./score";

describe("score bounds", () => {
  it("stays within 0–100", () => {
    const high = scoreFit(ARCHETYPE_DEFAULTS.operations_setup);
    const low = scoreFit(ARCHETYPE_DEFAULTS.compliance_review);
    expect(high.total).toBeGreaterThanOrEqual(0);
    expect(high.total).toBeLessThanOrEqual(100);
    expect(low.total).toBeGreaterThanOrEqual(0);
    expect(low.total).toBeLessThanOrEqual(100);
  });

  it("category scores respect their weights", () => {
    const breakdown = scoreFit(ARCHETYPE_DEFAULTS.support_triage);
    expect(breakdown.economicOpportunity).toBeLessThanOrEqual(SCORE_WEIGHTS.economicOpportunity);
    expect(breakdown.workflowStructure).toBeLessThanOrEqual(SCORE_WEIGHTS.workflowStructure);
    expect(breakdown.technicalReadiness).toBeLessThanOrEqual(SCORE_WEIGHTS.technicalReadiness);
    expect(breakdown.controllability).toBeLessThanOrEqual(SCORE_WEIGHTS.controllability);
    expect(breakdown.riskSuitability).toBeLessThanOrEqual(SCORE_WEIGHTS.riskSuitability);
    expect(breakdown.humanJudgmentSuitability).toBeLessThanOrEqual(SCORE_WEIGHTS.humanJudgmentSuitability);
  });

  it("is deterministic", () => {
    const a = scoreFit(ARCHETYPE_DEFAULTS.payment_exception);
    const b = scoreFit(ARCHETYPE_DEFAULTS.payment_exception);
    expect(a).toEqual(b);
  });
});
