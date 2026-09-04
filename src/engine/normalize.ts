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
  const gaps = completenessGaps(inputs);
  const total = gaps.length;
  const filled = gaps.filter((gap) => gap.ok).length;
  return total === 0 ? 0 : filled / total;
}

export type CompletenessGap = {
  id: string;
  label: string;
  ok: boolean;
  anchor: "define" | "economics" | "map" | "inventory" | "diagnosis";
};

/** Actionable checklist behind the sketch / completeness meter. */
export function completenessGaps(inputs: AssessmentInputs): CompletenessGap[] {
  const scales = [
    ...Object.values(inputs.structure),
    ...Object.values(inputs.systems),
    ...Object.values(inputs.risk),
    ...Object.values(inputs.humanLoop),
    inputs.economics.variability,
  ];
  const midpoint = scales.filter((v) => v === 3).length;

  const gaps: CompletenessGap[] = [
    { id: "name", label: "Named workflow", ok: inputs.name.trim().length > 1, anchor: "define" },
    { id: "volume", label: "Volume > 0", ok: inputs.economics.volume > 0, anchor: "economics" },
    { id: "minutes", label: "Minutes per case > 0", ok: inputs.economics.minutesPerCase > 0, anchor: "economics" },
    {
      id: "description",
      label: "Description or non-custom archetype",
      ok: Boolean(inputs.description.trim()) || inputs.archetype !== "custom",
      anchor: "define",
    },
    {
      id: "cost",
      label: "Hourly cost unset or > 0",
      ok: inputs.economics.loadedHourlyCost == null || inputs.economics.loadedHourlyCost > 0,
      anchor: "economics",
    },
  ];

  for (const [i, v] of scales.entries()) {
    gaps.push({
      id: `scale-${i}`,
      label: "Diagnosis scale 1–5",
      ok: v >= 1 && v <= 5,
      anchor: "diagnosis",
    });
  }

  if (inputs.archetype === "custom") {
    gaps.push({
      id: "midpoints",
      label: "Fewer than 70% midpoint (3) scores",
      ok: midpoint < scales.length * 0.7,
      anchor: "diagnosis",
    });
  }

  gaps.push(
    { id: "steps", label: "At least 2 workflow steps", ok: inputs.workflow.steps.length >= 2, anchor: "map" },
    { id: "systems", label: "At least 1 named system", ok: inputs.inventory.systems.length >= 1, anchor: "inventory" },
    {
      id: "failures",
      label: "At least one failure mode (or no steps yet)",
      ok:
        inputs.workflow.steps.some((step) => step.failureMode.trim().length > 0) ||
        inputs.workflow.steps.length === 0,
      anchor: "map",
    },
  );

  return gaps;
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
