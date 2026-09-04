import { Architecture } from "@/ui/components/Architecture";
import type { EconomicAssumptions, EvaluationResult } from "@/domain/types";

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function RecommendationTab({
  result,
  assumptions,
  onAssumptions,
}: {
  result: EvaluationResult;
  assumptions: EconomicAssumptions;
  onAssumptions: (next: Partial<EconomicAssumptions>) => void;
}) {
  return (
    <div>
      <div className="explain">
        <div>
          <h3>Strong signals</h3>
          <ul>
            {result.explanation.strongSignals.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Limiting factors</h3>
          <ul>
            {result.explanation.limitingFactors.map((item) => (
              <li key={item}>{`− ${item}`}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Therefore</h3>
          <p className="therefore">{result.explanation.therefore}</p>
        </div>
      </div>
      <div className="section-block">
        <h3 className="sys">Required for the recommended autonomy</h3>
        <ul className="control-list">
          {result.controlsRequired.map((control) => (
            <li key={control.id}>
              <b>{control.label}</b>
              <span>{control.rationale}</span>
            </li>
          ))}
        </ul>
      </div>
      {result.controlsBeforeAutonomyIncrease.length > 0 ? (
        <div className="section-block">
          <h3 className="sys">Required before increasing autonomy</h3>
          <ul className="control-list">
            {result.controlsBeforeAutonomyIncrease.map((control) => (
              <li key={control.id}>
                <b>{control.label}</b>
                <span>{control.rationale}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="section-block">
        <h3 className="sys">Readiness</h3>
        <p className="therefore mt-1">
          {result.readinessNote}
        </p>
        <p className="hint-faint mt-2">
          AgentFit supports discovery and system design. It does not authorize production deployment.
        </p>
      </div>
      <div className="section-block">
        <h3 className="sys">Capacity hypothesis</h3>
        <div className="kpis">
          <div>
            <span>Manual hours / week</span>
            <strong>{result.capacity.manualHoursWeek}</strong>
          </div>
          <div>
            <span>Net capacity returned</span>
            <strong>{result.capacity.netCapacityReturned}</strong>
          </div>
          {result.capacity.annualCapacityValue != null ? (
            <div>
              <span>Annual capacity value</span>
              <strong>{money(result.capacity.annualCapacityValue)}</strong>
            </div>
          ) : null}
          {result.capacity.annualLaborCost != null ? (
            <div>
              <span>Current annual labor</span>
              <strong>{money(result.capacity.annualLaborCost)}</strong>
            </div>
          ) : null}
        </div>
        <p className="hint-faint mt-2">
          Coverage and review time are assumptions. Capacity returned is not automatically savings.
        </p>
        <div className="econ-grid mt-2">
          <HypothesisSlider
            label="Expected coverage"
            value={assumptions.coverage}
            max={1}
            step={0.05}
            suffix={`${Math.round(assumptions.coverage * 100)}%`}
            onChange={(coverage) => onAssumptions({ coverage })}
          />
          <HypothesisSlider
            label="Time reduction"
            value={assumptions.timeReduction}
            max={1}
            step={0.05}
            suffix={`${Math.round(assumptions.timeReduction * 100)}%`}
            onChange={(timeReduction) => onAssumptions({ timeReduction })}
          />
          <HypothesisSlider
            label="Review minutes / case"
            value={assumptions.reviewMinutesPerCase}
            max={30}
            step={1}
            suffix={`${assumptions.reviewMinutesPerCase} min`}
            onChange={(reviewMinutesPerCase) => onAssumptions({ reviewMinutesPerCase })}
          />
        </div>
      </div>
      <div className="section-block">
        <h3 className="sys">Next experiment</h3>
        <p className="therefore mt-1">
          {result.experiment.title}
        </p>
        <p className="hint page-hint">
          {result.experiment.rationale}
        </p>
      </div>
      <div className="section-block">
        <h3 className="sys">System pattern</h3>
        <Architecture nodes={result.architecture} />
      </div>
      {result.confidenceReasons.length > 0 ? (
        <div className="section-block">
          <h3 className="sys">Confidence notes</h3>
          <ul>
            {result.confidenceReasons.map((note) => (
              <li key={note} className="rule-item prose-sm">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function HypothesisSlider({
  label,
  value,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (next: number) => void;
}) {
  const id = `hyp-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={id}>{`${label} · ${suffix}`}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
