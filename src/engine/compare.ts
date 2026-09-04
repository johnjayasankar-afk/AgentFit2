import type { EvaluationResult, PortfolioClass } from "@/domain/types";

export const PORTFOLIO_CLASSES: PortfolioClass[] = [
  "Build Now",
  "De-risk First",
  "Assist, Don't Agentify",
  "Automate Conventionally",
  "Low Priority",
];

/**
 * Portfolio class is for roadmap prioritization.
 * Economic attractiveness is not the same as Agent Fit, and neither is autonomy.
 */
export function classifyPortfolio(result: EvaluationResult): PortfolioClass {
  const { score, readiness, autonomy, pattern, breakdown, capacity } = result;
  const ready = readiness === "Pilot Ready" || readiness === "Production Candidate";
  const highValue = breakdown.economicOpportunity >= 10 || capacity.manualHoursWeek >= 12;
  const risky = breakdown.riskSuitability <= 8 || breakdown.controllability <= 10;

  if (pattern === "Deterministic Automation") return "Automate Conventionally";
  if (pattern === "Human-Led Process") {
    return highValue ? "Assist, Don't Agentify" : "Low Priority";
  }
  if (!highValue && score < 55) return "Low Priority";
  if (highValue && risky) return "De-risk First";
  if (autonomy <= 2) return "Assist, Don't Agentify";
  if (highValue && ready && autonomy >= 3) return "Build Now";
  if (highValue && !ready) return "De-risk First";
  if (score >= 55 && autonomy <= 2) return "Assist, Don't Agentify";
  return "Low Priority";
}

/** One-line decision. Not a second score. */
export function writeVerdict(result: EvaluationResult): string {
  const klass = result.portfolioClass;
  const auto = result.autonomyLabel;
  if (klass === "Automate Conventionally") {
    return `Do not agentify. ${auto} — a script is the product.`;
  }
  if (klass === "De-risk First") {
    return `Attractive economics, insufficient controls. Keep ${auto}; close the blockers before expanding independence.`;
  }
  if (klass === "Build Now") {
    return `${auto} is warranted for a bounded build. Agent Fit is opportunity, not an autonomy license.`;
  }
  if (klass === "Assist, Don't Agentify") {
    return `AI can help; autonomy is not the product. Hold at ${auto}.`;
  }
  return `Insufficient economics for an agent program. ${auto} is the ceiling until volume or access changes.`;
}

export function summarizePortfolio(results: EvaluationResult[]): {
  total: number;
  byClass: Record<PortfolioClass, number>;
  dominant: PortfolioClass | null;
  headline: string;
} {
  const byClass = Object.fromEntries(PORTFOLIO_CLASSES.map((klass) => [klass, 0])) as Record<
    PortfolioClass,
    number
  >;
  for (const result of results) {
    const klass = result.portfolioClass || classifyPortfolio(result);
    byClass[klass] += 1;
  }
  const total = results.length;
  const dominant =
    total === 0
      ? null
      : PORTFOLIO_CLASSES.reduce((best, klass) => (byClass[klass] > byClass[best] ? klass : best));
  const headline =
    total === 0
      ? "No saved assessments."
      : `${total} saved · ${dominant} is the largest class`;
  return { total, byClass, dominant, headline };
}

export function sharedBlockers(results: EvaluationResult[]): { id: string; title: string; count: number }[] {
  const counts = new Map<string, { title: string; count: number }>();
  for (const result of results) {
    for (const item of result.blockers) {
      const current = counts.get(item.id) ?? { title: item.title, count: 0 };
      current.count += 1;
      counts.set(item.id, current);
    }
  }
  return [...counts.entries()]
    .map(([id, value]) => ({ id, title: value.title, count: value.count }))
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count);
}
