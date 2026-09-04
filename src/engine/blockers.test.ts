import { describe, expect, it } from "vitest";
import { ARCHETYPE_DEFAULTS } from "@/data/presets";
import { autonomyBlockers } from "./blockers";
import { recommendAutonomy } from "./autonomy";
import { evaluate } from "./evaluate";

describe("autonomy blockers", () => {
  it("names consequence and reversibility on payment exception", () => {
    const inputs = ARCHETYPE_DEFAULTS.payment_exception;
    const blockers = autonomyBlockers(inputs, recommendAutonomy(inputs));
    const ids = blockers.map((b) => b.id);
    expect(ids).toContain("consequence");
    expect(ids).toContain("reversibility");
    expect(ids).not.toContain("conventional");
  });

  it("names conventional software on reporting", () => {
    const inputs = ARCHETYPE_DEFAULTS.reporting;
    const blockers = autonomyBlockers(inputs, recommendAutonomy(inputs));
    expect(blockers.some((b) => b.id === "conventional")).toBe(true);
  });

  it("names human-led judgment on regulatory sign-off", () => {
    const inputs = ARCHETYPE_DEFAULTS.compliance_review;
    const blockers = autonomyBlockers(inputs, recommendAutonomy(inputs));
    expect(blockers.some((b) => b.id === "human-led" || b.id === "consequence")).toBe(true);
  });

  it("is attached to evaluation results", () => {
    const result = evaluate(ARCHETYPE_DEFAULTS.payment_exception);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers.length).toBeLessThanOrEqual(4);
  });
});
