import { clamp, VOLUME_PERIOD_TO_WEEK } from "@/domain/model";
import type { AssessmentInputs, EconomicsInputs } from "@/domain/types";

export function weeklyCases(economics: EconomicsInputs): number {
  return Math.max(0, economics.volume) * VOLUME_PERIOD_TO_WEEK[economics.volumePeriod];
}

export function monthlyCases(economics: EconomicsInputs): number {
  return weeklyCases(economics) * 4.345;
}

export function weeklyManualHours(economics: EconomicsInputs): number {
  return (weeklyCases(economics) * Math.max(0, economics.minutesPerCase)) / 60;
}

export function monthlyManualHours(economics: EconomicsInputs): number {
  return weeklyManualHours(economics) * 4.345;
}

export function unit01(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return clamp(value / cap);
}

export function isNamed(inputs: AssessmentInputs): boolean {
  return inputs.name.trim().length > 0;
}

export function completeness(inputs: AssessmentInputs): number {
  let filled = 0;
  let total = 0;

  const mark = (ok: boolean) => {
    total += 1;
    if (ok) filled += 1;
  };

  mark(inputs.name.trim().length > 1);
  mark(inputs.economics.volume > 0);
  mark(inputs.economics.minutesPerCase > 0);
  mark(Boolean(inputs.description.trim()) || inputs.archetype !== "custom");
  mark(inputs.economics.loadedHourlyCost == null || inputs.economics.loadedHourlyCost > 0);

  const scales = [
    ...Object.values(inputs.structure),
    ...Object.values(inputs.systems),
    ...Object.values(inputs.risk),
    ...Object.values(inputs.humanLoop),
    inputs.economics.variability,
  ];
  for (const v of scales) {
    mark(v >= 1 && v <= 5);
  }

  if (inputs.archetype === "custom") {
    const midpoint = scales.filter((v) => v === 3).length;
    mark(midpoint < scales.length * 0.7);
  }

  mark(inputs.workflow.steps.length >= 2);
  mark(inputs.inventory.systems.length >= 1);
  mark(inputs.workflow.steps.some((step) => step.failureMode.trim().length > 0) || inputs.workflow.steps.length === 0);

  return total === 0 ? 0 : filled / total;
}

export function midpointShare(inputs: AssessmentInputs): number {
  const scales = [
    ...Object.values(inputs.structure),
    ...Object.values(inputs.systems),
    ...Object.values(inputs.risk),
    ...Object.values(inputs.humanLoop),
    inputs.economics.variability,
  ];
  if (scales.length === 0) return 0;
  return scales.filter((v) => v === 3).length / scales.length;
}
