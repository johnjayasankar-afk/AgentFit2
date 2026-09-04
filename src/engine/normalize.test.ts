import { describe, expect, it } from "vitest";
import { ARCHETYPE_DEFAULTS, EMPTY_ASSESSMENT } from "@/data/presets";
import { completeness, midpointShare } from "./normalize";

describe("completeness", () => {
  it("treats a named preset as more complete than a blank custom", () => {
    expect(completeness(ARCHETYPE_DEFAULTS.support_triage)).toBeGreaterThan(completeness(EMPTY_ASSESSMENT));
  });

  it("flags a custom sketch stuck at midpoints", () => {
    expect(midpointShare(EMPTY_ASSESSMENT)).toBeGreaterThanOrEqual(0.65);
    expect(completeness(EMPTY_ASSESSMENT)).toBeLessThan(1);
  });
});
