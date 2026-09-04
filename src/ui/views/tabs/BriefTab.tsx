import { briefText } from "@/engine/brief";
import type { AssessmentInputs, EvaluationResult, FmeaItem, RiskItem } from "@/domain/types";
import { downloadText } from "@/persistence/io";
import { useState } from "react";

export function BriefTab({
  result,
  inputs,
  notes,
  successCriteria,
  risks,
  fmea,
  chrome = true,
}: {
  result: EvaluationResult;
  inputs: AssessmentInputs;
  notes: string;
  successCriteria: string[];
  risks: RiskItem[];
  fmea: FmeaItem[];
  chrome?: boolean;
}) {
  const criteria = successCriteria.filter((item) => item.trim());
  const summary = briefText(inputs, result, { notes, successCriteria: criteria, risks, fmea });
  const [copied, setCopied] = useState(false);
  const fails = result.goNoGo.filter((gate) => gate.status === "fail");

  return (
    <div>
      {chrome ? (
        <div className="toolbar">
          <button
            type="button"
            className="line-btn"
            onClick={() => {
              void navigator.clipboard.writeText(summary).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                },
                () => {
                  setCopied(false);
                },
              );
            }}
          >
            {copied ? "Copied" : "Copy summary"}
          </button>
          <button
            type="button"
            className="line-btn"
            onClick={() =>
              downloadText(
                `${(inputs.name || "assessment").replace(/\s+/g, "-").toLowerCase()}-brief.txt`,
                summary,
                "text/plain",
              )
            }
          >
            Download brief
          </button>
          <button type="button" className="line-btn" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      ) : null}
      <article className="brief" style={{ marginTop: chrome ? 8 : 0 }}>
        <p className="sys">{result.modelLabel}</p>
        <h2 className="fit-heading" style={{ marginTop: 8 }}>
          {inputs.name.trim() || "Untitled workflow"}
        </h2>
        <p className="hint" style={{ marginTop: 8, color: "inherit", opacity: 0.55 }}>
          {inputs.description || "No description."}
        </p>
        <p className="verdict" style={{ marginTop: 16 }}>
          {result.verdict}
        </p>
        <dl className="brief-grid">
          <BriefPair q="Agent Fit" a={`${result.score} / 100`} />
          <BriefPair q="Autonomy" a={result.autonomyLabel} />
          <BriefPair q="Pattern" a={result.pattern} />
          <BriefPair q="Class" a={result.portfolioClass} />
          <BriefPair q="Control" a={result.controlPosture} />
          <BriefPair q="Capacity" a={`${result.capacity.netCapacityReturned} hrs / week potential`} />
          <BriefPair q="Readiness" a={result.readiness} />
          <BriefPair
            q="Design"
            a={`${result.design.stepCount} steps · ${result.design.systemCount} systems · ${Math.round(result.design.mappedCompleteness * 100)}% map`}
          />
        </dl>
        {notes.trim() ? (
          <div className="section-block">
            <h3 className="sys">Notes</h3>
            <p style={{ marginTop: 8 }}>{notes}</p>
          </div>
        ) : null}
        <div className="section-block">
          <h3 className="sys">Why this matters</h3>
          <p style={{ marginTop: 8 }}>{result.explanation.therefore}</p>
        </div>
        <div className="section-block">
          <h3 className="sys">What caps autonomy</h3>
          <ul>
            {result.blockers.length === 0 ? (
              <li style={{ padding: "6px 0" }}>No hard autonomy ceiling from these inputs.</li>
            ) : (
              result.blockers.map((item) => (
                <li key={item.id} className="rule-item">
                  <b>{item.title}</b>
                  {` — ${item.detail}`}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="section-block">
          <h3 className="sys">Failed gates</h3>
          <ul>
            {fails.length === 0 ? (
              <li style={{ padding: "6px 0" }}>None — still not a production authorization.</li>
            ) : (
              fails.map((gate) => (
                <li key={gate.id} className="rule-item">
                  <b>{gate.label}</b>
                  {` — ${gate.detail}`}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="section-block">
          <h3 className="sys">What to test next</h3>
          <p style={{ marginTop: 8 }}>{result.experiment.title}</p>
          {criteria.length > 0 ? (
            <ul style={{ marginTop: 10 }}>
              {criteria.map((item) => (
                <li key={item} className="rule-item">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {risks.length > 0 ? (
          <div className="section-block">
            <h3 className="sys">Risks and mitigations</h3>
            <ul style={{ marginTop: 8 }}>
              {risks.map((item) => (
                <li key={item.id} className="rule-item">
                  <b>{item.risk}</b>
                  {` — ${item.mitigation || "Mitigation unset"}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {fmea.length > 0 ? (
          <div className="section-block">
            <h3 className="sys">FMEA (top)</h3>
            <ul style={{ marginTop: 8 }}>
              {fmea.slice(0, 6).map((item) => (
                <li key={item.id} className="rule-item">
                  <b>{`RPN ${item.rpn}`}</b>
                  {` — ${item.failure}: ${item.mitigation || "Mitigation unset"}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="hint" style={{ marginTop: 24 }}>
          AgentFit supports discovery and system design. It does not authorize production deployment.
        </p>
      </article>
    </div>
  );
}

function BriefPair({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt>{q}</dt>
      <dd>{a}</dd>
    </div>
  );
}
