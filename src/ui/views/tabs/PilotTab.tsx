import type { EvaluationResult } from "@/domain/types";

export function PilotTab({
  result,
  successCriteria,
  onSuccessCriteria,
}: {
  result: EvaluationResult;
  successCriteria: string[];
  onSuccessCriteria: (next: string[] | null) => void;
}) {
  const pilot = result.pilot;
  const generated = result.experiment.successCriteria;
  const dirty =
    successCriteria.length !== generated.length ||
    successCriteria.some((item, index) => item !== generated[index]);

  return (
    <div>
      <div className="section-block lead">
        <h3 className="sys">Recommended next experiment</h3>
        <p className="therefore mt-1">
          {result.experiment.title}
        </p>
        <p className="hint page-hint">
          {result.experiment.rationale}
        </p>
      </div>
      <div className="section-block">
        <h3 className="sys">Success criteria</h3>
        <p className="hint-faint mt-1">
          Generated from the assessment. Edit freely.
        </p>
        {successCriteria.map((item, i) => (
          <div className="field criterion-row" key={i}>
            <label className="sys" htmlFor={`sc-${i}`}>
              {`Criterion ${String(i + 1).padStart(2, "0")}`}
            </label>
            <div className="criterion-edit">
              <input
                id={`sc-${i}`}
                type="text"
                value={item}
                onChange={(event) => {
                  const next = [...successCriteria];
                  next[i] = event.target.value;
                  onSuccessCriteria(next);
                }}
              />
              <button
                type="button"
                className="why-btn"
                aria-label={`Remove criterion ${i + 1}`}
                onClick={() => onSuccessCriteria(successCriteria.filter((_, index) => index !== i))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <div className="toolbar mt-1">
          <button type="button" className="why-btn" onClick={() => onSuccessCriteria([...successCriteria, ""])}>
            Add criterion
          </button>
          {dirty ? (
            <button type="button" className="why-btn" onClick={() => onSuccessCriteria(null)}>
              Restore generated criteria
            </button>
          ) : null}
        </div>
      </div>
      <PilotLine label="Scope" value={pilot.scope} />
      <PilotLine label="User group" value={pilot.userGroup} />
      <PilotList label="Allowed actions" items={pilot.allowedActions} />
      <PilotList label="Disallowed actions" items={pilot.disallowedActions} />
      <PilotLine label="Approval boundary" value={pilot.approvalBoundary} />
      <PilotLine label="Fallback" value={pilot.fallbackBehavior} />
      <PilotLine label="Logging" value={pilot.loggingRequirement} />
      <PilotList
        label="Evaluation metrics"
        items={result.evaluationPlan.map((metric) => `${metric.label} — ${metric.why}`)}
      />
      <PilotList label="Exit criteria" items={pilot.exitCriteria} />
    </div>
  );
}

function PilotLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="section-block">
      <h3 className="sys">{label}</h3>
      <p className="prose-sm mt-1">{value}</p>
    </div>
  );
}

function PilotList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="section-block">
      <h3 className="sys">{label}</h3>
      <ul>
        {items.map((item) => (
          <li key={item} className="rule-item">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
