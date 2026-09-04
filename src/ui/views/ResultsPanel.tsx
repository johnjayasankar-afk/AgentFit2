import type {
  AssessmentInputs,
  EconomicAssumptions,
  EvaluationResult,
  FmeaItem,
  ResultTab,
  RiskItem,
} from "@/domain/types";
import { SCORE_WEIGHTS } from "@/domain/model";
import { completenessGaps } from "@/engine/normalize";
import { gateTally } from "@/engine/gates";
import { AutonomyField } from "@/ui/components/AutonomyField";
import { RecommendationTab } from "@/ui/views/tabs/RecommendationTab";
import { DesignTab } from "@/ui/views/tabs/DesignTab";
import { ScenarioTab } from "@/ui/views/tabs/ScenarioTab";
import { SensitivityTab } from "@/ui/views/tabs/SensitivityTab";
import { PilotTab } from "@/ui/views/tabs/PilotTab";
import { RisksTab } from "@/ui/views/tabs/RisksTab";
import { GatesTab } from "@/ui/views/tabs/GatesTab";
import { BriefTab } from "@/ui/views/tabs/BriefTab";
import { useEffect, useRef } from "react";

const TABS: { id: ResultTab; label: string; section: string }[] = [
  { id: "recommendation", label: "Recommend", section: "01 · Recommend" },
  { id: "design", label: "Design", section: "02 · Design" },
  { id: "scenario", label: "Scenario lab", section: "03 · Scenario" },
  { id: "sensitivity", label: "Sensitivity", section: "04 · Sensitivity" },
  { id: "pilot", label: "Pilot", section: "05 · Pilot" },
  { id: "risks", label: "Risks", section: "06 · Risks" },
  { id: "gates", label: "Gates", section: "07 · Gates" },
  { id: "brief", label: "Brief", section: "08 · Brief" },
];

const BREAKDOWN: {
  key: string;
  label: string;
  max: number;
  value: (result: EvaluationResult) => number;
}[] = [
  { key: "econ", label: "Econ", max: SCORE_WEIGHTS.economicOpportunity, value: (r) => r.breakdown.economicOpportunity },
  { key: "struct", label: "Struct", max: SCORE_WEIGHTS.workflowStructure, value: (r) => r.breakdown.workflowStructure },
  { key: "tech", label: "Tech", max: SCORE_WEIGHTS.technicalReadiness, value: (r) => r.breakdown.technicalReadiness },
  { key: "ctrl", label: "Ctrl", max: SCORE_WEIGHTS.controllability, value: (r) => r.breakdown.controllability },
  { key: "risk", label: "Risk", max: SCORE_WEIGHTS.riskSuitability, value: (r) => r.breakdown.riskSuitability },
  {
    key: "judge",
    label: "Judge",
    max: SCORE_WEIGHTS.humanJudgmentSuitability,
    value: (r) => r.breakdown.humanJudgmentSuitability,
  },
];

export function ResultsPanel({
  result,
  inputs,
  notes,
  assumptions,
  scenarioInputs,
  onAssumptions,
  onScenario,
  onClearScenario,
  onAdoptScenario,
  onProbe,
  onCopyVerdict,
  tab,
  onTab,
  successCriteria,
  onSuccessCriteria,
  risks,
  onRisks,
  fmea,
  onFmea,
  onFocusAssess,
}: {
  result: EvaluationResult;
  inputs: AssessmentInputs;
  notes: string;
  assumptions: EconomicAssumptions;
  scenarioInputs: AssessmentInputs | null;
  onAssumptions: (next: Partial<EconomicAssumptions>) => void;
  onScenario: (next: AssessmentInputs) => void;
  onClearScenario: () => void;
  onAdoptScenario: () => void;
  onProbe: (next: AssessmentInputs) => void;
  onCopyVerdict: () => void;
  tab: ResultTab;
  onTab: (tab: ResultTab) => void;
  successCriteria: string[];
  onSuccessCriteria: (next: string[] | null) => void;
  risks: RiskItem[];
  onRisks: (next: RiskItem[] | null) => void;
  fmea: FmeaItem[];
  onFmea: (next: FmeaItem[] | null) => void;
  onFocusAssess: (anchor: "define" | "map" | "inventory" | "economics" | "diagnosis") => void;
}) {
  const sketch = result.completeness < 0.7;
  const gaps = completenessGaps(inputs);
  const openGaps = gaps.filter((gap) => !gap.ok && !gap.id.startsWith("scale-"));
  const firstGap = openGaps[0] ?? gaps.find((gap) => !gap.ok);
  const active = TABS.find((item) => item.id === tab) ?? TABS[0];
  const tablistRef = useRef<HTMLDivElement>(null);
  const tally = gateTally(result.goNoGo);
  const failGates = tally.fail;

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(min-width: 1081px)").matches) return;
    document.getElementById("result-panel")?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [tab]);

  return (
    <div>
      <div className="fit-sticky">
        <div className="fit-sticky-head">
          <p className="sys">{active.section}</p>
          <button type="button" className="ghost-btn sticky-action" onClick={onCopyVerdict}>
            Copy verdict
          </button>
        </div>
        <div
          className="fit-score"
          aria-live="polite"
          aria-label={`Fit score ${result.score} of 100`}
        >
          <span className="fit-score-num" aria-hidden="true" key={result.score}>
            {result.score}
          </span>
          <span className="fit-score-max" aria-hidden="true">
            /100
          </span>
        </div>
        <p className="fit-autonomy">{result.autonomyLabel}</p>
        <p className="fit-pattern">{result.pattern}</p>
        <p className="fit-class sys">
          {result.portfolioClass}
          {sketch ? (
            <>
              {" · "}
              <button
                type="button"
                className="instrument-link"
                onClick={() => onFocusAssess(firstGap?.anchor ?? "map")}
              >
                {`sketch ${Math.round(result.completeness * 100)}%`}
              </button>
            </>
          ) : null}
          {failGates > 0 ? (
            <>
              {" · "}
              <button
                type="button"
                className="instrument-link gate-chip"
                key={failGates}
                onClick={() => onTab("gates")}
              >
                {`${failGates} gate fail`}
              </button>
            </>
          ) : null}
        </p>
        <p className="verdict">{result.verdict}</p>
        <p className="fit-aside">
          Agent Fit is opportunity. Autonomy is a separate control decision. Map + gates make it a design, not a
          survey.
        </p>
        {sketch && openGaps.length > 0 ? (
          <div className="sketch-panel" aria-label="What keeps this a sketch">
            <p className="sys">To leave sketch</p>
            <ul className="sketch-list">
              {openGaps.slice(0, 6).map((gap) => (
                <li key={gap.id}>
                  <button type="button" className="instrument-link" onClick={() => onFocusAssess(gap.anchor)}>
                    {gap.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {result.blockers.length > 0 ? (
        <ul className="blockers" aria-label="What caps autonomy">
          {result.blockers.map((item) => (
            <li key={item.id}>
              <b>{item.title}</b>
              <span>{item.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="fit-visual">
        <AutonomyField result={result} />
      </div>
      <div className="breakdown">
        {BREAKDOWN.map((row) => {
          const value = row.value(result);
          const pct = Math.round((value / row.max) * 100);
          return (
            <div key={row.key}>
              <span>{row.label}</span>
              <strong>{value}</strong>
              <span className="meter" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
            </div>
          );
        })}
      </div>
      <div className="kpis">
        <div>
          <span>Control posture</span>
          <strong>{result.controlPosture}</strong>
        </div>
        <div>
          <span>Potential capacity returned</span>
          <strong>{`${result.capacity.netCapacityReturned} hrs / week`}</strong>
        </div>
        <div>
          <span>Readiness</span>
          <strong>{result.readiness}</strong>
        </div>
        <div>
          <span>Map · gates</span>
          <strong>
            <button
              type="button"
              className="instrument-link strong-link"
              onClick={() => {
                if (result.design.stepCount === 0) onFocusAssess("map");
                else onTab(failGates > 0 ? "gates" : "design");
              }}
            >
              {`${result.design.stepCount} steps`}
            </button>
            <span className="kpi-sub">
              <button type="button" className="instrument-link" onClick={() => onTab("gates")}>
                {`${failGates} fail · ${tally.warn} warn`}
              </button>
              {` · ${result.design.systemCount} systems`}
            </span>
          </strong>
        </div>
      </div>
      <div
        className="tabs"
        role="tablist"
        aria-label="Recommendation views"
        ref={tablistRef}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
            return;
          }
          event.preventDefault();
          const index = TABS.findIndex((item) => item.id === tab);
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
          if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = TABS.length - 1;
          onTab(TABS[next].id);
          queueMicrotask(() => {
            tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          });
        }}
      >
        {TABS.map((item, index) => (
          <button
            key={item.id}
            id={`result-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="result-panel"
            aria-keyshortcuts={String(index + 1)}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? "on" : ""}
            onClick={() => onTab(item.id)}
          >
            <span className="tab-key" aria-hidden="true">
              {index + 1}
            </span>
            {` ${item.label}`}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="result-panel" aria-labelledby={`result-tab-${tab}`}>
        {tab === "recommendation" ? (
          <RecommendationTab result={result} assumptions={assumptions} onAssumptions={onAssumptions} />
        ) : null}
        {tab === "design" ? (
          <DesignTab result={result} onFocusMap={() => onFocusAssess("map")} onOpenGates={() => onTab("gates")} />
        ) : null}
        {tab === "scenario" ? (
          <ScenarioTab
            current={inputs}
            currentResult={result}
            scenario={scenarioInputs}
            onScenario={onScenario}
            onClear={onClearScenario}
            onAdopt={onAdoptScenario}
          />
        ) : null}
        {tab === "sensitivity" ? <SensitivityTab inputs={inputs} onProbe={onProbe} /> : null}
        {tab === "pilot" ? (
          <PilotTab result={result} successCriteria={successCriteria} onSuccessCriteria={onSuccessCriteria} />
        ) : null}
        {tab === "risks" ? (
          <RisksTab result={result} risks={risks} onChange={onRisks} fmea={fmea} onFmea={onFmea} />
        ) : null}
        {tab === "gates" ? (
          <GatesTab
            result={result}
            onFix={(target) => {
              if (target === "design" || target === "risks" || target === "recommend") {
                onTab(target === "recommend" ? "recommendation" : target);
                return;
              }
              onFocusAssess(target);
            }}
          />
        ) : null}
        {tab === "brief" ? (
          <BriefTab
            result={result}
            inputs={inputs}
            notes={notes}
            successCriteria={successCriteria}
            risks={risks}
            fmea={fmea}
          />
        ) : (
          <div className="print-brief" aria-hidden="true">
            <BriefTab
              result={result}
              inputs={inputs}
              notes={notes}
              successCriteria={successCriteria}
              risks={risks}
              fmea={fmea}
              chrome={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
