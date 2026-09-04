import { describe, expect, it } from "vitest";
import { ARCHETYPE_DEFAULTS } from "@/data/presets";
import { createRecord } from "@/persistence/db";
import { exportAssessment, parseIncoming, toCsv } from "@/persistence/io";

describe("import / export", () => {
  it("round-trips a single assessment", () => {
    const record = createRecord({ inputs: ARCHETYPE_DEFAULTS.support_triage });
    const payload = exportAssessment(record);
    const parsed = parseIncoming(JSON.parse(JSON.stringify(payload)) as unknown);
    expect(parsed.type).toBe("assessment");
    if (parsed.type === "assessment") {
      expect(parsed.record.inputs.name).toBe(record.inputs.name);
      expect(parsed.record.id).toBe(record.id);
    }
  });

  it("accepts a record missing notes from an older export", () => {
    const record = createRecord({ inputs: ARCHETYPE_DEFAULTS.support_triage });
    const payload = exportAssessment(record);
    const legacy = JSON.parse(JSON.stringify(payload)) as { assessment: { notes?: string } };
    delete legacy.assessment.notes;
    const parsed = parseIncoming(legacy);
    expect(parsed.type).toBe("assessment");
    if (parsed.type === "assessment") {
      expect(parsed.record.notes).toBe("");
    }
  });

  it("accepts a record missing later edit fields from an older export", () => {
    const record = createRecord({ inputs: ARCHETYPE_DEFAULTS.support_triage });
    const payload = exportAssessment(record);
    const legacy = JSON.parse(JSON.stringify(payload)) as {
      assessment: {
        scenarioInputs?: unknown;
        editedSuccessCriteria?: unknown;
        editedRisks?: unknown;
        editedPilot?: unknown;
      };
    };
    delete legacy.assessment.scenarioInputs;
    delete legacy.assessment.editedSuccessCriteria;
    delete legacy.assessment.editedRisks;
    delete legacy.assessment.editedPilot;
    const parsed = parseIncoming(legacy);
    expect(parsed.type).toBe("assessment");
    if (parsed.type === "assessment") {
      expect(parsed.record.scenarioInputs).toBeNull();
      expect(parsed.record.editedSuccessCriteria).toBeNull();
      expect(parsed.record.editedRisks).toBeNull();
      expect(parsed.record.editedPilot).toBeNull();
    }
  });

  it("rejects unknown JSON", () => {
    expect(() => parseIncoming({ hello: "nope" })).toThrow(/not a recognized AgentFit export/);
  });

  it("emits a CSV header and a row", () => {
    const record = createRecord({ inputs: ARCHETYPE_DEFAULTS.reporting });
    const csv = toCsv([record]);
    expect(csv.startsWith("name,archetype,fit")).toBe(true);
    expect(csv).toContain("Reporting");
    expect(csv).toContain("Conventional Software");
  });
});
