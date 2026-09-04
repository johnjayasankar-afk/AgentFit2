import { DIMENSIONS, polarityLabel } from "@/data/dimensions";
import { SCORE_WEIGHTS } from "@/domain/model";
import { modKey } from "@/util/mod";
import { useMemo, useState } from "react";

const WEIGHT_LABELS: Record<string, string> = {
  economicOpportunity: "Economic opportunity",
  workflowStructure: "Workflow structure",
  technicalReadiness: "Technical readiness",
  controllability: "Controllability",
  riskSuitability: "Risk suitability",
  humanJudgmentSuitability: "Human judgment suitability",
};

const GROUP_LABELS: Record<string, string> = {
  economics: "Economics",
  structure: "Structure",
  systems: "Systems",
  risk: "Risk",
  humanLoop: "Human in the loop",
};

export function MethodologyView() {
  const [query, setQuery] = useState("");
  const mod = modKey();
  const dims = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return DIMENSIONS;
    return DIMENSIONS.filter((dim) =>
      `${dim.name} ${dim.definition} ${dim.why} ${dim.group}`.toLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <div className="sheet sheet-md">
      <p className="sys">Methodology · AgentFit Model 1.0</p>
      <h1 className="fit-heading page-title">
        How the instrument decides
      </h1>
      <p className="lede page-lede">
        Autonomy is a product decision, not a model-size decision. AgentFit separates opportunity from
        independence, and independence from readiness.
      </p>
      <section className="section-block">
        <h2 className="fit-heading subhead-lg">
          Four measures
        </h2>
        <dl className="brief-grid">
          <div>
            <dt>Agent Fit</dt>
            <dd>Opportunity and suitability for an agentic implementation. Not an autonomy license.</dd>
          </div>
          <div>
            <dt>Autonomy</dt>
            <dd>How independently the system should act, given risk, verification, and access.</dd>
          </div>
          <div>
            <dt>Readiness</dt>
            <dd>Whether the environment could support a discovery prototype or a limited pilot.</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>Potential human time returned under stated coverage and review assumptions.</dd>
          </div>
        </dl>
      </section>
      <section className="section-block">
        <h2 className="fit-heading subhead-lg">
          Agent Fit weights
        </h2>
        <ul>
          {Object.entries(SCORE_WEIGHTS).map(([key, weight]) => (
            <li key={key} className="row" style={{ gridTemplateColumns: "1fr 80px" }}>
              <span>{WEIGHT_LABELS[key] ?? key}</span>
              <span>{weight}</span>
            </li>
          ))}
        </ul>
        <p className="hint mt-2">
          A conventional-automation penalty is applied when rules, structure, and low judgment make a script
          the better product. Historical assessments store modelVersion so later weight changes remain
          interpretable.
        </p>
      </section>
      <section className="section-block">
        <h2 className="fit-heading subhead-lg">
          Portfolio class
        </h2>
        <p className="lede mt-2">
          Class is a roadmap lens, not a second Agent Fit score. The verdict is the one-line decision the rest of
          the instrument exists to support.
        </p>
        <ul className="explain">
          <li>
            <b>Build Now</b> — high fit and enough readiness to start a bounded build.
          </li>
          <li>
            <b>De-risk First</b> — the economics are attractive; controls are not.
          </li>
          <li>
            <b>Assist, Don't Agentify</b> — AI is useful; autonomy is not the product.
          </li>
          <li>
            <b>Automate Conventionally</b> — a rules engine or script is the better system.
          </li>
          <li>
            <b>Low Priority</b> — insufficient economics for an agent program.
          </li>
        </ul>
      </section>
      <section className="section-block">
        <h2 className="fit-heading subhead-lg">
          What caps autonomy
        </h2>
        <p className="lede mt-2">
          The blockers list is not a second score. It names the constraints that keep independence below what a
          high Agent Fit might suggest: consequence, reversibility, access, verification, policy, and whether a
          script would be the better product.
        </p>
      </section>
      <section className="section-block">
        <h2 className="fit-heading subhead-lg">
          Autonomy ladder
        </h2>
        <ol className="explain">
          <li>0 · Conventional Software — rules and scripts; no generative execution path.</li>
          <li>1 · Copilot — AI assists; the human owns interpretation and execution.</li>
          <li>2 · Assistive Agent — researches, drafts, recommends; human still acts.</li>
          <li>3 · Supervised Agent — multi-step tool use; approval for consequential writes.</li>
          <li>4 · Bounded Agent — independent inside limits, rollback, and escalation.</li>
          <li>5 · Autonomous System — rare. Requires low consequence, strong verification, and cheap reversal.</li>
        </ol>
      </section>
      <section className="section-block">
        <h2 className="fit-heading subhead-lg">
          Dimensions
        </h2>
        <input
          className="search"
          value={query}
          placeholder="Filter dimensions"
          aria-label="Filter dimensions"
          onChange={(event) => setQuery(event.target.value)}
        />
        {dims.length === 0 ? <p className="hint">No dimensions match.</p> : null}
        {dims.map((dim) => (
          <div key={dim.key} className="section-block method-dim">
            <p className="sys">{GROUP_LABELS[dim.group] ?? dim.group}</p>
            <h3 className="method-dim-title">{dim.name}</h3>
            <p className="hint">{polarityLabel(dim.polarity)}</p>
            <p className="method-dim-body">{dim.definition}</p>
            <p className="hint">{`1 · ${dim.low} → 5 · ${dim.high}`}</p>
            <p className="hint">{dim.why}</p>
          </div>
        ))}
      </section>
      <section className="section-block">
        <h2 className="fit-heading subhead-lg">
          Keyboard
        </h2>
        <ul className="explain">
          <li>
            <b>{`${mod}K`}</b> — command palette. Theme, export, copy verdict, examples.
          </li>
          <li>
            <b>?</b> — Method (model notes and keyboard).
          </li>
          <li>
            <b>{`${mod}S / ${mod}N / ${mod}L / ${mod}E`}</b> — save, new, library, export JSON.
          </li>
          <li>
            <b>1–8</b> — Recommend, Design, Scenario, Sensitivity, Pilot, Risks, Gates, Brief. Arrow keys move across tabs.
          </li>
          <li>
            <b>G</b> — jump to Gates while assessing (when not typing).
          </li>
        </ul>
      </section>
      <p className="sys mt-4">
        AgentFit supports discovery and system design. It does not authorize production deployment.
      </p>
    </div>
  );
}
