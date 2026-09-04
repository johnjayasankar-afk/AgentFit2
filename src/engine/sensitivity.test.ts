import { describe, expect, it } from "vitest";
import { ARCHETYPE_DEFAULTS } from "@/data/presets";
import { applySensitivityMove } from "./sensitivity";
import { evaluate } from "./evaluate";

describe("sensitivity probe", () => {
  it("moves a dimension and can change the recommendation", () => {
    const base = ARCHETYPE_DEFAULTS.payment_exception;
    const next = applySensitivityMove(base, "reversibility");
    expect(next.risk.reversibility).not.toBe(base.risk.reversibility);
    const from = evaluate(base);
    const to = evaluate(next);
    expect(to.score !== from.score || to.autonomy !== from.autonomy || to.verdict !== from.verdict).toBe(true);
  });
});
