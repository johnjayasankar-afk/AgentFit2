import { describe, expect, it } from "vitest";
import { ARCHETYPE_DEFAULTS } from "@/data/presets";
import { classifyPortfolio, sharedBlockers, summarizePortfolio } from "./compare";
import { diffEvaluations, evaluate } from "./evaluate";

describe("portfolio classification", () => {
  it("de-risks high-value high-consequence work", () => {
    const result = evaluate(ARCHETYPE_DEFAULTS.payment_exception);
    expect(result.portfolioClass).toBe("De-risk First");
    expect(classifyPortfolio(result)).toBe("De-risk First");
    expect(result.verdict.toLowerCase()).toMatch(/control|blocker/);
  });

  it("routes reporting to conventional automation", () => {
    const result = evaluate(ARCHETYPE_DEFAULTS.reporting);
    expect(result.portfolioClass).toBe("Automate Conventionally");
    expect(result.verdict.toLowerCase()).toMatch(/script|do not agentify/);
  });

  it("keeps compliance in assist-not-agentify or de-risk", () => {
    const klass = evaluate(ARCHETYPE_DEFAULTS.compliance_review).portfolioClass;
    expect(["Assist, Don't Agentify", "De-risk First", "Low Priority"]).toContain(klass);
  });

  it("summarizes a mixed portfolio", () => {
    const results = [
      evaluate(ARCHETYPE_DEFAULTS.payment_exception),
      evaluate(ARCHETYPE_DEFAULTS.reporting),
      evaluate(ARCHETYPE_DEFAULTS.support_triage),
    ];
    const summary = summarizePortfolio(results);
    expect(summary.total).toBe(3);
    expect(summary.byClass["Automate Conventionally"]).toBe(1);
    expect(summary.byClass["De-risk First"]).toBeGreaterThanOrEqual(1);
    expect(summary.headline).toMatch(/saved/);
  });

  it("diffs class and verdict across archetypes", () => {
    const delta = diffEvaluations(
      evaluate(ARCHETYPE_DEFAULTS.payment_exception),
      evaluate(ARCHETYPE_DEFAULTS.reporting),
    );
    expect(delta.klass.from).toBe("De-risk First");
    expect(delta.klass.to).toBe("Automate Conventionally");
    expect(delta.verdict.from).not.toBe(delta.verdict.to);
  });

  it("names blockers shared by two high-consequence assessments", () => {
    const shared = sharedBlockers([
      evaluate(ARCHETYPE_DEFAULTS.payment_exception),
      evaluate(ARCHETYPE_DEFAULTS.compliance_review),
    ]);
    expect(shared.some((row) => row.id === "consequence" || row.id === "policy")).toBe(true);
  });
});

