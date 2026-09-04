import { newStepId, newSystemId } from "@/engine/design";
import type {
  AssessmentInputs,
  Scale,
  SystemAccessLevel,
  SystemAsset,
  WorkflowActor,
  WorkflowStep,
} from "@/domain/types";

const ACTORS: WorkflowActor[] = ["human", "system", "either"];
const ACCESS: SystemAccessLevel[] = ["none", "read", "write", "admin"];

export function WorkflowInventoryEditors({
  inputs,
  onChange,
}: {
  inputs: AssessmentInputs;
  onChange: (next: AssessmentInputs) => void;
}) {
  const steps = inputs.workflow.steps;
  const systems = inputs.inventory.systems;

  const setSteps = (next: WorkflowStep[]) =>
    onChange({ ...inputs, workflow: { steps: next } });
  const setSystems = (next: SystemAsset[]) =>
    onChange({ ...inputs, inventory: { systems: next } });

  return (
    <>
      <section className="section-block" id="assess-map">
        <p className="sys">Map</p>
        <h3 className="fit-heading subhead">
          Steps the work actually takes
        </h3>
        <p className="hint page-hint">
          This is the difference between a survey and a design. Name handoffs, who acts, which systems are
          touched, and how a step fails.
        </p>
        {steps.length === 0 ? (
          <p className="hint mt-2">
            No steps yet. Add the real sequence — ingest → decide → act → verify.
          </p>
        ) : null}
        <ol className="design-list">
          {steps.map((step, index) => (
            <li key={step.id}>
              <div className="design-row">
                <span className="sys">{String(index + 1).padStart(2, "0")}</span>
                <input
                  type="text"
                  aria-label={`Step ${index + 1} name`}
                  placeholder="Step name"
                  value={step.name}
                  onChange={(event) => {
                    const next = [...steps];
                    next[index] = { ...step, name: event.target.value };
                    setSteps(next);
                  }}
                />
                <select
                  aria-label={`Step ${index + 1} actor`}
                  value={step.actor}
                  onChange={(event) => {
                    const next = [...steps];
                    next[index] = { ...step, actor: event.target.value as WorkflowActor };
                    setSteps(next);
                  }}
                >
                  {ACTORS.map((actor) => (
                    <option key={actor} value={actor}>
                      {actor}
                    </option>
                  ))}
                </select>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={step.reversible}
                    onChange={(event) => {
                      const next = [...steps];
                      next[index] = { ...step, reversible: event.target.checked };
                      setSteps(next);
                    }}
                  />
                  Reversible
                </label>
                <button
                  type="button"
                  className="why-btn"
                  disabled={index === 0}
                  aria-label={`Move step ${index + 1} up`}
                  onClick={() => {
                    if (index === 0) return;
                    const next = [...steps];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    setSteps(next);
                  }}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="why-btn"
                  disabled={index === steps.length - 1}
                  aria-label={`Move step ${index + 1} down`}
                  onClick={() => {
                    if (index >= steps.length - 1) return;
                    const next = [...steps];
                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                    setSteps(next);
                  }}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="why-btn"
                  onClick={() => setSteps(steps.filter((item) => item.id !== step.id))}
                >
                  Remove
                </button>
              </div>
              <input
                type="text"
                aria-label={`Step ${index + 1} action`}
                placeholder="What happens"
                value={step.action}
                onChange={(event) => {
                  const next = [...steps];
                  next[index] = { ...step, action: event.target.value };
                  setSteps(next);
                }}
              />
              <input
                type="text"
                aria-label={`Step ${index + 1} systems`}
                placeholder="Systems touched (comma-separated)"
                value={step.systems.join(", ")}
                onChange={(event) => {
                  const next = [...steps];
                  next[index] = {
                    ...step,
                    systems: event.target.value
                      .split(",")
                      .map((part) => part.trim())
                      .filter(Boolean),
                  };
                  setSteps(next);
                }}
              />
              <input
                type="text"
                aria-label={`Step ${index + 1} failure mode`}
                placeholder="How this step fails"
                value={step.failureMode}
                onChange={(event) => {
                  const next = [...steps];
                  next[index] = { ...step, failureMode: event.target.value };
                  setSteps(next);
                }}
              />
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="line-btn mt-2"
          onClick={() =>
            setSteps([
              ...steps,
              {
                id: newStepId(),
                name: "",
                actor: "either",
                action: "",
                systems: [],
                failureMode: "",
                reversible: true,
              },
            ])
          }
        >
          Add step
        </button>
      </section>

      <section className="section-block" id="assess-inventory">
        <p className="sys">Inventory</p>
        <h3 className="fit-heading subhead">
          What an agent would touch
        </h3>
        <p className="hint page-hint">
          Named systems with access level beat vague “tooling readiness.” Write and admin access drive FMEA and
          go/no-go gates.
        </p>
        {systems.length === 0 ? (
          <p className="hint mt-2">
            No systems yet. Name the CRM, ledger, inbox, or tool an agent would actually touch.
          </p>
        ) : null}
        <ul className="design-list">
          {systems.map((system, index) => (
            <li key={system.id}>
              <div className="design-row">
                <input
                  type="text"
                  aria-label={`System ${index + 1} name`}
                  placeholder="System name"
                  value={system.name}
                  onChange={(event) => {
                    const next = [...systems];
                    next[index] = { ...system, name: event.target.value };
                    setSystems(next);
                  }}
                />
                <select
                  aria-label={`System ${index + 1} access`}
                  value={system.access}
                  onChange={(event) => {
                    const next = [...systems];
                    next[index] = { ...system, access: event.target.value as SystemAccessLevel };
                    setSystems(next);
                  }}
                >
                  {ACCESS.map((access) => (
                    <option key={access} value={access}>
                      {access}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`System ${index + 1} criticality`}
                  value={system.criticality}
                  onChange={(event) => {
                    const next = [...systems];
                    next[index] = { ...system, criticality: Number(event.target.value) as Scale };
                    setSystems(next);
                  }}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {`Crit ${value}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="why-btn"
                  onClick={() => setSystems(systems.filter((item) => item.id !== system.id))}
                >
                  Remove
                </button>
              </div>
              <input
                type="text"
                aria-label={`System ${index + 1} notes`}
                placeholder="Notes — why this system matters"
                value={system.notes}
                onChange={(event) => {
                  const next = [...systems];
                  next[index] = { ...system, notes: event.target.value };
                  setSystems(next);
                }}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="line-btn mt-2"
          onClick={() =>
            setSystems([
              ...systems,
              { id: newSystemId(), name: "", access: "read", criticality: 3, notes: "" },
            ])
          }
        >
          Add system
        </button>
      </section>
    </>
  );
}
