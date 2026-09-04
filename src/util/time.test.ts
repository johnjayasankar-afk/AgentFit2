import { describe, expect, it } from "vitest";
import { relativeTime } from "./time";

describe("relativeTime", () => {
  const now = Date.parse("2026-09-04T15:00:00.000Z");

  it("formats recent deltas", () => {
    expect(relativeTime("2026-09-04T14:59:30.000Z", now)).toBe("just now");
    expect(relativeTime("2026-09-04T14:45:00.000Z", now)).toBe("15m ago");
    expect(relativeTime("2026-09-04T12:00:00.000Z", now)).toBe("3h ago");
    expect(relativeTime("2026-09-02T15:00:00.000Z", now)).toBe("2d ago");
  });
});
