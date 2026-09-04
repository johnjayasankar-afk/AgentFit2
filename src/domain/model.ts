import type { Scale } from "./types";
import { MODEL_LABEL, MODEL_VERSION } from "./types";

export { MODEL_LABEL, MODEL_VERSION };

/** Product shell version — independent of scoring Model 1.0. */
export const SHELL_VERSION = "4.1.1";

/** Category weights. Sum = 100 before conventional-automation penalty. */
export const SCORE_WEIGHTS = {
  economicOpportunity: 20,
  workflowStructure: 15,
  technicalReadiness: 20,
  controllability: 20,
  riskSuitability: 15,
  humanJudgmentSuitability: 10,
} as const;

export const ECONOMIC_WEIGHTS = {
  volume: 0.35,
  timePerCase: 0.25,
  weeklyHours: 0.4,
} as const;

export const STRUCTURE_WEIGHTS = {
  ruleClarity: 0.4,
  inputStructure: 0.35,
  exceptionBurden: 0.25,
} as const;

export const TECHNICAL_WEIGHTS = {
  systemAccess: 0.3,
  toolingReadiness: 0.3,
  context: 0.2,
  observability: 0.2,
} as const;

export const CONTROL_WEIGHTS = {
  reversibility: 0.3,
  verification: 0.3,
  feedback: 0.2,
  escalation: 0.2,
} as const;

export const RISK_WEIGHTS = {
  failureConsequence: 0.35,
  blastRadius: 0.3,
  regulatorySensitivity: 0.25,
  permissionComplexity: 0.1,
} as const;

/** Reference points for economic normalization. */
export const ECONOMIC_REFS = {
  weeklyCasesCap: 100,
  minutesCap: 35,
  weeklyHoursCap: 20,
  variabilityDrag: 0.14,
} as const;

/**
 * Default coverage / time-reduction / review minutes by autonomy.
 * These are starting hypotheses, not laws. Users can edit them.
 */
export const AUTONOMY_ASSUMPTIONS: Record<
  0 | 1 | 2 | 3 | 4 | 5,
  { coverage: number; timeReduction: number; reviewMinutes: number }
> = {
  0: { coverage: 0.75, timeReduction: 0.7, reviewMinutes: 2 },
  1: { coverage: 0.3, timeReduction: 0.3, reviewMinutes: 8 },
  2: { coverage: 0.5, timeReduction: 0.5, reviewMinutes: 6 },
  3: { coverage: 0.65, timeReduction: 0.62, reviewMinutes: 5 },
  4: { coverage: 0.8, timeReduction: 0.78, reviewMinutes: 2 },
  5: { coverage: 0.9, timeReduction: 0.88, reviewMinutes: 1 },
};

export const VOLUME_PERIOD_TO_WEEK: Record<"day" | "week" | "month", number> = {
  day: 5,
  week: 1,
  month: 1 / 4.345,
};

export function scaleToUnit(value: Scale): number {
  return (value - 1) / 4;
}

export function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

export function clampScore(n: number): number {
  return Math.round(clamp(n, 0, 100));
}

export function asScale(n: number): Scale {
  const rounded = Math.round(clamp(n, 1, 5));
  return rounded as Scale;
}
