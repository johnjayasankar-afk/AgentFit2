import type { EvaluationResult } from "@/domain/types";
import { Architecture } from "@/ui/components/Architecture";

export function DesignTab({ result }: { result: EvaluationResult }) {
  const { design } = result;
  return (
    <div>
      <div className="section-block" style={{ marginTop: 8, borderTop: 0, paddingTop: 8 }}>
        <h3 className="sys">Design summary</h3>
        <p className="hint" style={{ marginTop: 8, color: "inherit", opacity: 0.55 }}>
          Workflow map and systems inventory turn scales into an implementable agent design. Mapping quality is
          separate from Agent Fit score.
        </p>
        <div className="kpis" style={{ marginTop: 12 }}>
          <div>
            <span>Steps mapped</span>
            <strong>{design.stepCount}</strong>
          </div>
          <div>
            <span>Systems</span>
            <strong>{design.systemCount}</strong>
          </div>
          <div>
            <span>Write / admin</span>
            <strong>{design.writeSystemCount}</strong>
          </div>
          <div>
            <span>Irreversible steps</span>
            <strong>{design.irreversibleSteps}</strong>
          </div>
          <div>
            <span>Human-only steps</span>
            <strong>{design.humanOnlySteps}</strong>
          </div>
          <div>
            <span>Map completeness</span>
            <strong>{`${Math.round(design.mappedCompleteness * 100)}%`}</strong>
          </div>
        </div>
      </div>
      <div className="section-block">
        <h3 className="sys">Recommended system pattern</h3>
        <p className="therefore" style={{ marginTop: 8 }}>
          {result.pattern}
        </p>
        <Architecture nodes={result.architecture} />
      </div>
      <div className="section-block">
        <h3 className="sys">Control posture</h3>
        <p style={{ marginTop: 8, fontSize: 14 }}>{result.controlPosture}</p>
        <ul className="control-list" style={{ marginTop: 12 }}>
          {result.controlsRequired.map((control) => (
            <li key={control.id}>
              <b>{control.label}</b>
              <span>{control.rationale}</span>
            </li>
          ))}
        </ul>
      </div>
      {design.stepCount === 0 ? (
        <p className="hint" style={{ marginTop: 16, color: "inherit", opacity: 0.55 }}>
          Add workflow steps on the left to unlock FMEA depth and go/no-go design gates.
        </p>
      ) : null}
    </div>
  );
}
