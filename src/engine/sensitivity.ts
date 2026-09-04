import { asScale } from "@/domain/model";
import type { AssessmentInputs, SensitivityRow } from "@/domain/types";
import { recommendAutonomy } from "./autonomy";
import { scoreFit } from "./score";

type Path =
  | ["economics", "variability"]
  | ["structure", keyof AssessmentInputs["structure"]]
  | ["systems", keyof AssessmentInputs["systems"]]
  | ["risk", keyof AssessmentInputs["risk"]]
  | ["humanLoop", keyof AssessmentInputs["humanLoop"]];

const DIMENSIONS: { key: string; label: string; path: Path }[] = [
  { key: "ruleClarity", label: "Rule clarity", path: ["structure", "ruleClarity"] },
  { key: "inputStructure", label: "Input structure", path: ["structure", "inputStructure"] },
  { key: "contextBreadth", label: "Context breadth", path: ["structure", "contextBreadth"] },
  { key: "exceptionRate", label: "Exception rate", path: ["structure", "exceptionRate"] },
  { key: "systemAccess", label: "System access", path: ["systems", "systemAccess"] },
  { key: "toolingReadiness", label: "Tooling readiness", path: ["systems", "toolingReadiness"] },
  { key: "permissionComplexity", label: "Permission complexity", path: ["systems", "permissionComplexity"] },
  { key: "observability", label: "Observability", path: ["systems", "observability"] },
  { key: "verification", label: "Verification", path: ["systems", "verification"] },
  { key: "reversibility", label: "Reversibility", path: ["risk", "reversibility"] },
  { key: "failureConsequence", label: "Failure consequence", path: ["risk", "failureConsequence"] },
  { key: "blastRadius", label: "Blast radius", path: ["risk", "blastRadius"] },
  { key: "humanJudgment", label: "Human judgment", path: ["risk", "humanJudgment"] },
  { key: "regulatorySensitivity", label: "Regulatory sensitivity", path: ["risk", "regulatorySensitivity"] },
  { key: "escalationAvailability", label: "Escalation availability", path: ["humanLoop", "escalationAvailability"] },
  { key: "feedbackAvailability", label: "Feedback availability", path: ["humanLoop", "feedbackAvailability"] },
  { key: "variability", label: "Variability", path: ["economics", "variability"] },
];

export function applySensitivityMove(inputs: AssessmentInputs, key: string): AssessmentInputs {
  const dim = DIMENSIONS.find((item) => item.key === key);
  if (!dim) return inputs;
  const current = readScale(inputs, dim.path);
  return writeScale(inputs, dim.path, improve(dim.key, current));
}

export function analyzeSensitivity(inputs: AssessmentInputs): SensitivityRow[] {
  const baseScore = scoreFit(inputs).total;
  const baseAutonomy = recommendAutonomy(inputs);

  return DIMENSIONS.map((dim) => {
    const current = readScale(inputs, dim.path);
    const improved = improve(dim.key, current);
    const next = writeScale(inputs, dim.path, improved);
    const fitDelta = scoreFit(next).total - baseScore;
    const autonomyDelta = recommendAutonomy(next) - baseAutonomy;
    const magnitude = Math.abs(fitDelta) + Math.abs(autonomyDelta) * 8;
    const leverage: SensitivityRow["leverage"] =
      magnitude >= 8 || autonomyDelta !== 0 ? "high" : magnitude >= 3 ? "medium" : "low";
    return {
      key: dim.key,
      label: dim.label,
      fitDelta,
      autonomyDelta,
      leverage,
    };
  }).sort((a, b) => rank(b) - rank(a));
}

function rank(row: SensitivityRow): number {
  return Math.abs(row.autonomyDelta) * 10 + Math.abs(row.fitDelta);
}

function improve(key: string, current: number): number {
  const constraining = new Set([
    "exceptionRate",
    "permissionComplexity",
    "failureConsequence",
    "blastRadius",
    "humanJudgment",
    "regulatorySensitivity",
    "variability",
    "reviewCost",
    "approvalLatency",
  ]);
  const delta = constraining.has(key) ? -1 : 1;
  return asScale(current + delta);
}

function readScale(inputs: AssessmentInputs, path: Path): number {
  const [group, key] = path;
  const bag = inputs[group] as unknown as Record<string, number>;
  return bag[key];
}

function writeScale(inputs: AssessmentInputs, path: Path, value: number): AssessmentInputs {
  const [group, key] = path;
  return {
    ...inputs,
    [group]: {
      ...inputs[group],
      [key]: asScale(value),
    },
  };
}
