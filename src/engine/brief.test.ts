import { describe, expect, it } from "vitest";
import { briefText } from "./brief";
import { evaluate } from "./evaluate";
import { ARCHETYPE_DEFAULTS, cloneInputs } from "@/data/presets";

describe("briefText", () => {
  it("states that AgentFit does not authorize production", () => {
    const inputs = cloneInputs(ARCHETYPE_DEFAULTS.support_triage);
    const result = evaluate(inputs);
    expect(briefText(inputs, result).toLowerCase()).toContain("does not authorize production");
  });

  it("includes edited success criteria and risk mitigations", () => {
    const inputs = cloneInputs(ARCHETYPE_DEFAULTS.support_triage);
    const result = evaluate(inputs);
    const text = briefText(inputs, result, {
      successCriteria: ["Custom criterion A"],
      risks: [{ id: "r1", risk: "Latency spike", why: "x", mitigation: "Cap concurrency", severity: 3 }],
    });
    expect(text).toContain("Custom criterion A");
    expect(text).toContain("Latency spike: Cap concurrency");
  });
});
