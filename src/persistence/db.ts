import Dexie, { type Table } from "dexie";
import { EMPTY_ASSESSMENT } from "@/data/presets";
import { MODEL_VERSION } from "@/domain/model";
import type { AssessmentRecord, EconomicAssumptions } from "@/domain/types";
import { normalizeInputs } from "@/engine/design";
import { defaultAssumptions } from "@/engine/economics";
import { evaluate } from "@/engine/evaluate";

export class AgentFitDB extends Dexie {
  assessments!: Table<AssessmentRecord, string>;

  constructor() {
    super("agentfit");
    this.version(1).stores({
      assessments: "id, updatedAt, archived",
    });
  }
}

export const db = new AgentFitDB();

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `af_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createRecord(
  partial?: Partial<AssessmentRecord> & { assumptions?: Partial<EconomicAssumptions> },
): AssessmentRecord {
  const inputs = normalizeInputs(partial?.inputs ?? EMPTY_ASSESSMENT);
  const autonomy = evaluate(inputs).autonomy;
  const assumptions: EconomicAssumptions = {
    ...defaultAssumptions(autonomy),
    ...partial?.assumptions,
  };
  const result = evaluate(inputs, assumptions);
  const ts = nowIso();
  return {
    id: partial?.id ?? createId(),
    modelVersion: MODEL_VERSION,
    createdAt: partial?.createdAt ?? ts,
    updatedAt: ts,
    archived: partial?.archived ?? false,
    demo: partial?.demo ?? false,
    notes: partial?.notes ?? "",
    inputs,
    assumptions,
    result,
    scenarioInputs: partial?.scenarioInputs ? normalizeInputs(partial.scenarioInputs) : null,
    editedSuccessCriteria: partial?.editedSuccessCriteria ?? null,
    editedRisks: partial?.editedRisks ?? null,
    editedFmea: partial?.editedFmea ?? null,
    editedPilot: partial?.editedPilot ?? null,
  };
}

export async function saveRecord(record: AssessmentRecord): Promise<void> {
  const next: AssessmentRecord = {
    ...record,
    modelVersion: MODEL_VERSION,
    updatedAt: nowIso(),
    result: evaluate(record.inputs, record.assumptions),
  };
  await db.assessments.put(next);
}

export async function listRecords(): Promise<AssessmentRecord[]> {
  const rows = await db.assessments.toArray();
  return rows.map(hydrateRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRecord(id: string): Promise<AssessmentRecord | undefined> {
  const row = await db.assessments.get(id);
  return row ? hydrateRecord(row) : undefined;
}

export async function deleteRecord(id: string): Promise<void> {
  await db.assessments.delete(id);
}

export async function duplicateRecord(id: string): Promise<AssessmentRecord | null> {
  const src = await db.assessments.get(id);
  if (!src) return null;
  const live = hydrateRecord(src);
  const copy = createRecord({
    inputs: {
      ...live.inputs,
      name: live.inputs.name ? `${live.inputs.name} (copy)` : "Untitled copy",
    },
    assumptions: live.assumptions,
    notes: live.notes,
    scenarioInputs: live.scenarioInputs,
    editedSuccessCriteria: live.editedSuccessCriteria,
    editedRisks: live.editedRisks,
    editedFmea: live.editedFmea,
    editedPilot: live.editedPilot,
    demo: false,
  });
  await db.assessments.put(copy);
  return copy;
}

export async function archiveRecord(id: string, archived = true): Promise<void> {
  const src = await db.assessments.get(id);
  if (!src) return;
  await db.assessments.put({ ...src, archived, updatedAt: nowIso() });
}

export function hydrateRecord(record: AssessmentRecord): AssessmentRecord {
  const notes = typeof record.notes === "string" ? record.notes : "";
  const inputs = normalizeInputs(record.inputs);
  return {
    ...record,
    notes,
    demo: Boolean(record.demo),
    archived: Boolean(record.archived),
    inputs,
    scenarioInputs: record.scenarioInputs ? normalizeInputs(record.scenarioInputs) : null,
    editedFmea: record.editedFmea ?? null,
    result: evaluate(inputs, record.assumptions),
  };
}

export async function wipeAll(): Promise<void> {
  await db.assessments.clear();
}
