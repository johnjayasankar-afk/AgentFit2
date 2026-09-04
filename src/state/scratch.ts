import { assessmentRecordSchema } from "@/domain/schema";
import type { AssessmentRecord } from "@/domain/types";

const KEY = "agentfit.scratch.v1";

export interface Scratch {
  record: AssessmentRecord;
  dirty: boolean;
}

export function writeScratch(record: AssessmentRecord, dirty: boolean): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ record, dirty }));
  } catch {
    /* quota or private mode */
  }
}

export function readScratch(): Scratch | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    const record = assessmentRecordSchema.safeParse(rec.record);
    if (!record.success) return null;
    return { record: record.data as AssessmentRecord, dirty: rec.dirty === true };
  } catch {
    return null;
  }
}

export function clearScratch(): void {
  sessionStorage.removeItem(KEY);
}
