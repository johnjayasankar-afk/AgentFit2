import { ARCHETYPE_LABELS } from "@/data/presets";
import { DIMENSIONS } from "@/data/dimensions";
import type { AssessmentInputs, Scale, VolumePeriod, WorkflowArchetype } from "@/domain/types";
import { weeklyManualHours } from "@/engine/normalize";
import { DimensionSlider } from "@/ui/components/DimensionSlider";
import { WorkflowInventoryEditors } from "@/ui/components/WorkflowInventoryEditors";

const ARCHETYPES = Object.entries(ARCHETYPE_LABELS) as [WorkflowArchetype, string][];
const PERIODS: VolumePeriod[] = ["day", "week", "month"];

export function AssessForm({
  inputs,
  notes,
  onChange,
  onNotes,
  onArchetype,
}: {
  inputs: AssessmentInputs;
  notes: string;
  onChange: (next: AssessmentInputs) => void;
  onNotes: (notes: string) => void;
  onArchetype: (archetype: WorkflowArchetype) => void;
}) {
  const setEconomics = <K extends keyof AssessmentInputs["economics"]>(
    key: K,
    value: AssessmentInputs["economics"][K],
  ) => {
    onChange({ ...inputs, economics: { ...inputs.economics, [key]: value } });
  };

  return (
    <div>
    <div id="assess-define">
      <p className="sys">Define</p>
      <h2 className="fit-heading">Define the work</h2>
      <p className="hint page-hint">
        Archetypes are starting points. Map the workflow and systems — then score the diagnosis.
      </p>
      <div className="field">
        <label htmlFor="wf-name">Workflow name</label>
        <input
          id="wf-name"
          type="text"
          value={inputs.name}
          placeholder="Payment exception investigation"
          onChange={(event) => onChange({ ...inputs, name: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="wf-desc">Description</label>
        <textarea
          id="wf-desc"
          value={inputs.description}
          placeholder="Optional. What actually happens, for whom, and when it matters."
          onChange={(event) => onChange({ ...inputs, description: event.target.value })}
        />
      </div>
      <p className="sys mt-3">
        Workflow archetype
      </p>
      <div className="presets" role="group" aria-label="Workflow archetype">
        {ARCHETYPES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={inputs.archetype === id ? "on" : ""}
            aria-pressed={inputs.archetype === id}
            onClick={() => onArchetype(id)}
          >
            {label}
          </button>
        ))}
      </div>
      </div>

      <WorkflowInventoryEditors inputs={inputs} onChange={onChange} />

      <section className="section-block" id="assess-economics">
        <p className="sys">Economics</p>
        <h3 className="fit-heading subhead">
          Volume and time
        </h3>
        <div className="econ-grid">
          <div className="field">
            <label htmlFor="volume">Workflow volume</label>
            <input
              id="volume"
              type="number"
              min={0}
              value={inputs.economics.volume || ""}
              onChange={(event) =>
                setEconomics("volume", event.target.value === "" ? 0 : Number(event.target.value))
              }
            />
          </div>
          <div className="field">
            <label>Period</label>
            <div className="seg mt-2" role="group" aria-label="Volume period">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  className={inputs.economics.volumePeriod === period ? "on" : ""}
                  aria-pressed={inputs.economics.volumePeriod === period}
                  onClick={() => setEconomics("volumePeriod", period)}
                >
                  {`per ${period}`}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="minutes">Average minutes per case</label>
            <input
              id="minutes"
              type="number"
              min={0}
              value={inputs.economics.minutesPerCase || ""}
              onChange={(event) =>
                setEconomics(
                  "minutesPerCase",
                  event.target.value === "" ? 0 : Number(event.target.value),
                )
              }
            />
          </div>
          <div className="field">
            <label htmlFor="people">People involved</label>
            <input
              id="people"
              type="number"
              min={0}
              value={inputs.economics.peopleInvolved ?? ""}
              placeholder="Optional"
              onChange={(event) =>
                setEconomics("peopleInvolved", event.target.value === "" ? null : Number(event.target.value))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="cost">Loaded hourly cost</label>
            <input
              id="cost"
              type="number"
              min={0}
              value={inputs.economics.loadedHourlyCost ?? ""}
              placeholder="Optional"
              onChange={(event) =>
                setEconomics("loadedHourlyCost", event.target.value === "" ? null : Number(event.target.value))
              }
            />
          </div>
        </div>
        <p className="hint mt-2">
          Cost is optional. Without it, AgentFit reports potential capacity returned — not savings.
        </p>
        <p className="econ-live sys" aria-live="polite">
          {`${formatHours(weeklyManualHours(inputs.economics))} hrs / week current load`}
          {inputs.economics.loadedHourlyCost
            ? ` · ${formatMoney(weeklyManualHours(inputs.economics) * 52 * inputs.economics.loadedHourlyCost)} / yr labor at stated rate`
            : ""}
        </p>
        <DimensionGroup group="economics" keys={["variability"]} inputs={inputs} onChange={onChange} />
      </section>
      <section className="section-block" id="assess-diagnosis">
        <p className="sys">Diagnosis</p>
        <h3 className="fit-heading subhead">
          Workflow structure
        </h3>
        <DimensionGroup
          group="structure"
          keys={["ruleClarity", "inputStructure", "contextBreadth", "exceptionRate"]}
          inputs={inputs}
          onChange={onChange}
        />
      </section>
      <section className="section-block">
        <h3 className="fit-heading subhead">
          System readiness
        </h3>
        <DimensionGroup
          group="systems"
          keys={["systemAccess", "toolingReadiness", "permissionComplexity", "observability", "verification"]}
          inputs={inputs}
          onChange={onChange}
        />
      </section>
      <section className="section-block">
        <h3 className="fit-heading subhead">
          Action and risk
        </h3>
        <DimensionGroup
          group="risk"
          keys={["reversibility", "failureConsequence", "blastRadius", "humanJudgment", "regulatorySensitivity"]}
          inputs={inputs}
          onChange={onChange}
        />
      </section>
      <section className="section-block">
        <h3 className="fit-heading subhead">
          Human in the loop
        </h3>
        <DimensionGroup
          group="humanLoop"
          keys={["reviewCost", "approvalLatency", "escalationAvailability", "feedbackAvailability"]}
          inputs={inputs}
          onChange={onChange}
        />
      </section>
      <section className="section-block">
        <p className="sys">Notes</p>
        <div className="field">
          <label htmlFor="wf-notes">Stay on this device</label>
          <textarea
            id="wf-notes"
            value={notes}
            placeholder="Context a future you would need: owners, constraints, decisions already made."
            onChange={(event) => onNotes(event.target.value)}
          />
        </div>
      </section>
    </div>
  );
}

function DimensionGroup<G extends "economics" | "structure" | "systems" | "risk" | "humanLoop">({
  group,
  keys,
  inputs,
  onChange,
}: {
  group: G;
  keys: (keyof AssessmentInputs[G] & string)[];
  inputs: AssessmentInputs;
  onChange: (next: AssessmentInputs) => void;
}) {
  return (
    <>
      {keys.map((key) => {
        const meta = DIMENSIONS.find((dim) => dim.key === key);
        if (!meta) return null;
        const value = inputs[group][key] as Scale;
        return (
          <DimensionSlider
            key={key}
            meta={meta}
            value={value}
            onChange={(next) =>
              onChange({
                ...inputs,
                [group]: { ...inputs[group], [key]: next },
              })
            }
          />
        );
      })}
    </>
  );
}

function formatHours(n: number): string {
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
