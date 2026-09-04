import { DIMENSIONS, type DimensionMeta } from "@/data/dimensions";
import { cloneInputs } from "@/data/presets";
import type { AssessmentInputs, EvaluationResult, Scale } from "@/domain/types";
import { diffEvaluations, evaluate } from "@/engine/evaluate";
import { AutonomyField } from "@/ui/components/AutonomyField";
import { DimensionSlider } from "@/ui/components/DimensionSlider";
import { useRef } from "react";

const SCENARIO_KEYS = [
  "systemAccess",
  "toolingReadiness",
  "verification",
  "observability",
  "reversibility",
  "exceptionRate",
  "permissionComplexity",
  "escalationAvailability",
] as const;

function scaleOf(
  inputs: AssessmentInputs,
  group: "economics" | "structure" | "systems" | "risk" | "humanLoop",
  key: string,
): Scale {
  return (inputs[group] as unknown as Record<string, Scale>)[key];
}

function patchScale(
  inputs: AssessmentInputs,
  group: "economics" | "structure" | "systems" | "risk" | "humanLoop",
  key: string,
  value: Scale,
): AssessmentInputs {
  return {
    ...inputs,
    [group]: {
      ...inputs[group],
      [key]: value,
    },
  };
}

export function ScenarioTab({
  current,
  currentResult,
  scenario,
  onScenario,
  onClear,
  onAdopt,
}: {
  current: AssessmentInputs;
  currentResult: EvaluationResult;
  scenario: AssessmentInputs | null;
  onScenario: (next: AssessmentInputs) => void;
  onClear: () => void;
  onAdopt: () => void;
}) {
  const working = scenario ?? current;
  const scenarioRef = useRef(working);
  scenarioRef.current = working;
  const nextResult = evaluate(working);
  const delta = diffEvaluations(currentResult, nextResult);
  const baseline = currentResult;

  const movers = DIMENSIONS.flatMap((meta) => {
    const from = scaleOf(current, meta.group, meta.key);
    const to = scaleOf(working, meta.group, meta.key);
    if (from === to) return [];
    const isolated = evaluate(patchScale(current, meta.group, meta.key, to));
    const moved =
      isolated.score !== baseline.score ||
      isolated.autonomy !== baseline.autonomy ||
      isolated.readiness !== baseline.readiness ||
      isolated.portfolioClass !== baseline.portfolioClass;
    return moved
      ? [
          {
            key: meta.key,
            label: meta.name,
            from,
            to,
            fit: isolated.score - baseline.score,
            autonomy: isolated.autonomy !== baseline.autonomy,
            klass: isolated.portfolioClass !== baseline.portfolioClass,
          },
        ]
      : [];
  });
  const extraSliders = DIMENSIONS.filter(
    (meta) =>
      !(SCENARIO_KEYS as readonly string[]).includes(meta.key) &&
      scaleOf(current, meta.group, meta.key) !== scaleOf(working, meta.group, meta.key),
  );

  const setScale = (
    group: "economics" | "structure" | "systems" | "risk" | "humanLoop",
    key: string,
    value: Scale,
  ) => {
    const next = patchScale(scenarioRef.current, group, key, value);
    scenarioRef.current = next;
    onScenario(next);
  };

  return (
    <div>
      <p className="hint mt-3">
        What would need to change before this workflow deserves more autonomy?
      </p>
      <div className="toolbar">
        <button
          type="button"
          className="line-btn"
          onClick={() => {
            const next = cloneInputs(current);
            scenarioRef.current = next;
            onScenario(next);
          }}
        >
          Clone current into scenario
        </button>
        {scenario ? (
          <>
            <button type="button" className="line-btn" onClick={onAdopt}>
              Adopt scenario as current
            </button>
            <button type="button" className="ghost-btn" onClick={onClear}>
              Reset scenario
            </button>
          </>
        ) : null}
      </div>
      <div className="kpis">
        <Delta label="Agent Fit" from={String(delta.score.from)} to={String(delta.score.to)} />
        <Delta label="Autonomy" from={delta.autonomy.from} to={delta.autonomy.to} />
        <Delta label="Class" from={delta.klass.from} to={delta.klass.to} />
        <Delta label="Readiness" from={delta.readiness.from} to={delta.readiness.to} />
      </div>
      {delta.verdict.from !== delta.verdict.to ? (
        <p className="verdict mt-3">
          {delta.verdict.to}
        </p>
      ) : null}
      {movers.length > 0 ? (
        <div className="section-block lead">
          <h3 className="sys">What moved the recommendation</h3>
          <ul className="path-list">
            {movers.map((row) => (
              <li key={row.key}>
                <b>{row.label}</b>
                <span>{`${row.from} → ${row.to}`}</span>
                <span className="sys">
                  {row.klass
                    ? "class"
                    : row.autonomy
                      ? "autonomy"
                      : `fit ${row.fit > 0 ? "+" : ""}${row.fit}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {([
        ...SCENARIO_KEYS.map((key) => DIMENSIONS.find((dim) => dim.key === key)),
        ...extraSliders,
      ].filter(Boolean) as DimensionMeta[]).map((meta) => {
          const value = scaleOf(working, meta.group, meta.key);
          const original = scaleOf(current, meta.group, meta.key);
          return (
            <DimensionSlider
              key={meta.key}
              meta={meta}
              value={value}
              changed={Boolean(scenario) && value !== original}
              idPrefix="scenario"
              onChange={(next) => setScale(meta.group, meta.key, next)}
            />
          );
        })}
      <div className="section-block">
        <h3 className="sys">Path to next autonomy level</h3>
        {currentResult.pathToNextAutonomy.length === 0 ? (
          <p className="hint mt-2">
            No further autonomy increase is recommended from these inputs.
          </p>
        ) : (
          <ul className="path-list">
            {currentResult.pathToNextAutonomy.map((step) => (
              <li key={step.title}>
                <b>{step.title}</b>
                <span>{step.detail}</span>
                <span className="sys">
                {DIMENSIONS.find((dim) => dim.key === step.dimension)?.name ?? step.dimension.replace(/-/g, " ")}
              </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="fit-visual nested">
        <AutonomyField result={currentResult} scenario={scenario ? nextResult : null} />
      </div>
    </div>
  );
}

function Delta({ label, from, to }: { label: string; from: string; to: string }) {
  const changed = from !== to;
  return (
    <div>
      <span>{label}</span>
      <strong>{changed ? `${from} → ${to}` : from}</strong>
    </div>
  );
}
