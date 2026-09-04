import type { EvaluationResult } from "@/domain/types";
import { PORTFOLIO_CLASSES, summarizePortfolio } from "@/engine/compare";

export function PortfolioStrip({ results }: { results: EvaluationResult[] }) {
  const summary = summarizePortfolio(results);
  if (summary.total === 0) return null;
  return (
    <p className="portfolio-strip" aria-label="Portfolio composition">
      <span className="sys">{summary.headline}</span>
      <span className="portfolio-counts">
        {PORTFOLIO_CLASSES.filter((klass) => summary.byClass[klass] > 0).map((klass) => (
          <span key={klass} className="sys">
            {`${summary.byClass[klass]} ${klass}`}
          </span>
        ))}
      </span>
    </p>
  );
}
