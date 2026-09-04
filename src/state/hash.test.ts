import { describe, expect, it } from "vitest";
import { hashForView, parseHash, viewFromHash } from "./hash";

describe("hash routes", () => {
  it("maps aliases and known views", () => {
    expect(viewFromHash("#method")).toBe("methodology");
    expect(viewFromHash("#data")).toBe("settings");
    expect(viewFromHash("#library")).toBe("library");
    expect(viewFromHash("#assess")).toBe("assess");
    expect(viewFromHash("#assess/brief")).toBe("assess");
    expect(viewFromHash("")).toBeNull();
    expect(viewFromHash("#nope")).toBeNull();
  });

  it("reads result tabs from assess hashes", () => {
    expect(parseHash("#assess/brief").tab).toBe("brief");
    expect(parseHash("#assess/scenario").tab).toBe("scenario");
    expect(parseHash("#assess").tab).toBeNull();
    expect(parseHash("#library/brief").tab).toBe("brief");
  });

  it("round-trips primary views", () => {
    expect(viewFromHash(hashForView("library"))).toBe("library");
    expect(viewFromHash(hashForView("methodology"))).toBe("methodology");
    expect(viewFromHash(hashForView("settings"))).toBe("settings");
    expect(hashForView("welcome")).toBe("#");
    expect(hashForView("assess", "brief")).toBe("#assess/brief");
    expect(hashForView("assess", "recommendation")).toBe("#assess");
  });
});
