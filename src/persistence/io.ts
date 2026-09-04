import { MODEL_VERSION } from "@/domain/model";
import { assessmentExportSchema, assessmentRecordSchema, workspaceBackupSchema } from "@/domain/schema";
import type { AssessmentExport, AssessmentRecord, WorkspaceBackup } from "@/domain/types";
import { classifyPortfolio } from "@/engine/compare";
import { createId, createRecord, db, nowIso } from "./db";

export function exportAssessment(record: AssessmentRecord): AssessmentExport {
  return {
    kind: "agentfit.assessment",
    version: 1,
    exportedAt: nowIso(),
    assessment: record,
  };
}

export function exportWorkspace(records: AssessmentRecord[]): WorkspaceBackup {
  return {
    kind: "agentfit.workspace",
    version: 1,
    exportedAt: nowIso(),
    modelVersion: MODEL_VERSION,
    assessments: records,
  };
}

function toRecord(value: unknown): AssessmentRecord {
  const parsed = assessmentRecordSchema.parse(value);
  return parsed as AssessmentRecord;
}

export function parseIncoming(raw: unknown):
  | { type: "assessment"; record: AssessmentRecord }
  | { type: "workspace"; records: AssessmentRecord[] } {
  const asAssessment = assessmentExportSchema.safeParse(raw);
  if (asAssessment.success) {
    return { type: "assessment", record: toRecord(asAssessment.data.assessment) };
  }
  const asWorkspace = workspaceBackupSchema.safeParse(raw);
  if (asWorkspace.success) {
    return { type: "workspace", records: asWorkspace.data.assessments.map(toRecord) };
  }
  const asRecord = assessmentRecordSchema.safeParse(raw);
  if (asRecord.success) {
    return { type: "assessment", record: toRecord(asRecord.data) };
  }
  throw new Error("This file is not a recognized AgentFit export.");
}

export async function importAssessment(
  record: AssessmentRecord,
  mode: "copy" | "skip",
): Promise<string> {
  const existing = await db.assessments.get(record.id);
  if (existing && mode === "skip") return existing.id;
  const next = createRecord({
    ...record,
    id: existing ? createId() : record.id,
    demo: false,
  });
  await db.assessments.put(next);
  return next.id;
}

export async function importWorkspace(records: AssessmentRecord[]): Promise<number> {
  let count = 0;
  for (const record of records) {
    await importAssessment(record, "copy");
    count += 1;
  }
  return count;
}

export function toCsv(records: AssessmentRecord[]): string {
  const header = [
    "name",
    "archetype",
    "fit",
    "autonomy",
    "pattern",
    "readiness",
    "capacity_hrs_week",
    "confidence",
    "class",
    "verdict",
    "top_blocker",
    "updated",
    "model",
  ];
  const rows = records.map((r) =>
    [
      csv(r.inputs.name),
      csv(r.inputs.archetype),
      r.result.score,
      csv(r.result.autonomyLabel),
      csv(r.result.pattern),
      csv(r.result.readiness),
      r.result.capacity.netCapacityReturned,
      csv(r.result.confidence),
      csv(r.result.portfolioClass || classifyPortfolio(r.result)),
      csv(r.result.verdict ?? ""),
      csv(r.result.blockers[0]?.title ?? ""),
      csv(r.updatedAt),
      csv(r.modelVersion),
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, text: string, type = "application/json"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
