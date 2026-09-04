import { describe, expect, it } from "vitest";
import { ARCHETYPE_DEFAULTS, cloneInputs } from "@/data/presets";
import { evaluate } from "./evaluate";
import { gateTally } from "./gates";

describe("design layer", () => {
  it("builds FMEA and go/no-go from a mapped payment exception", () => {
    const result = evaluate(cloneInputs(ARCHETYPE_DEFAULTS.payment_exception));
    expect(result.design.stepCount).toBeGreaterThanOrEqual(3);
    expect(result.design.systemCount).toBeGreaterThanOrEqual(2);
    expect(result.fmea.length).toBeGreaterThan(0);
    expect(result.goNoGo.length).toBeGreaterThan(5);
    const tally = gateTally(result.goNoGo);
    expect(tally.pass + tally.warn + tally.fail + tally.unknown).toBe(result.goNoGo.length);
  });

  it("fails the workflow-map gate when no steps are mapped", () => {
    const inputs = cloneInputs(ARCHETYPE_DEFAULTS.custom);
    inputs.name = "Empty map";
    inputs.workflow = { steps: [] };
    inputs.inventory = { systems: [] };
    const result = evaluate(inputs);
    const mapGate = result.goNoGo.find((gate) => gate.id === "workflow-map");
    expect(mapGate?.status).toBe("fail");
  });
});
