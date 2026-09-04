import { AUTONOMY_ASSUMPTIONS, clamp } from "@/domain/model";
import type {
  AssessmentInputs,
  AutonomyLevel,
  CapacityModel,
  EconomicAssumptions,
} from "@/domain/types";
import { monthlyCases, monthlyManualHours, weeklyCases, weeklyManualHours } from "./normalize";

export function defaultAssumptions(level: AutonomyLevel): EconomicAssumptions {
  const base = AUTONOMY_ASSUMPTIONS[level];
  return {
    coverage: base.coverage,
    timeReduction: base.timeReduction,
    reviewMinutesPerCase: base.reviewMinutes,
  };
}

export function isDefaultAssumptions(assumptions: EconomicAssumptions, level: AutonomyLevel): boolean {
  const expected = defaultAssumptions(level);
  return (
    assumptions.coverage === expected.coverage &&
    assumptions.timeReduction === expected.timeReduction &&
    assumptions.reviewMinutesPerCase === expected.reviewMinutesPerCase
  );
}

export function calculateCapacity(
  inputs: AssessmentInputs,
  level: AutonomyLevel,
  assumptions?: Partial<EconomicAssumptions>,
): CapacityModel {
  const fallback = defaultAssumptions(level);
  const coverage = clamp(assumptions?.coverage ?? fallback.coverage);
  const timeReduction = clamp(assumptions?.timeReduction ?? fallback.timeReduction);
  const reviewMinutes = Math.max(0, assumptions?.reviewMinutesPerCase ?? fallback.reviewMinutesPerCase);

  const weekCases = weeklyCases(inputs.economics);
  const monthCases = monthlyCases(inputs.economics);
  const manualHoursWeek = weeklyManualHours(inputs.economics);
  const manualHoursMonth = monthlyManualHours(inputs.economics);

  const potentialAutomatedHours = manualHoursWeek * coverage * timeReduction;
  const reviewHours = (weekCases * coverage * reviewMinutes) / 60;
  const netCapacityReturned = Math.max(0, potentialAutomatedHours - reviewHours * 0.35);

  const rate = inputs.economics.loadedHourlyCost;
  const monthlyLaborCost = rate != null && rate > 0 ? manualHoursMonth * rate : null;
  const annualLaborCost = monthlyLaborCost != null ? monthlyLaborCost * 12 : null;
  const annualCapacityValue =
    rate != null && rate > 0 ? netCapacityReturned * 52 * rate : null;

  return {
    weeklyCases: round1(weekCases),
    monthlyCases: round1(monthCases),
    manualHoursWeek: round1(manualHoursWeek),
    manualHoursMonth: round1(manualHoursMonth),
    potentialAutomatedHours: round1(potentialAutomatedHours),
    reviewHours: round1(reviewHours),
    netCapacityReturned: round1(netCapacityReturned),
    monthlyLaborCost: monthlyLaborCost != null ? Math.round(monthlyLaborCost) : null,
    annualLaborCost: annualLaborCost != null ? Math.round(annualLaborCost) : null,
    annualCapacityValue: annualCapacityValue != null ? Math.round(annualCapacityValue) : null,
    coverageUsed: coverage,
    timeReductionUsed: timeReduction,
    reviewMinutesUsed: reviewMinutes,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
