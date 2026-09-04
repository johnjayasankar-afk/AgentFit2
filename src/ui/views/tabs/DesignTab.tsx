import type { EvaluationResult } from "@/domain/types";
import { Architecture } from "@/ui/components/Architecture";

export function DesignTab({
  result,
  onFocusMap,
  onOpenGates,
}: {
  result: EvaluationResult;
  onFocusMap: () => void;
  onOpenGates: () => void;
}) {
  const { design } = result;
  return (
    <div>
      <div className="section-block lead">
        <h3 className="sys">Design summary</h3>
        <p className="hint page-hint">
          Workflow map and systems inventory turn scales into an implementable agent design. Mapping quality is
          separate from Agent Fit score.
        </p>
        <div className="kpis mt-2">
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
        <p className="therefore mt-1">{result.pattern}</p>
        <Architecture nodes={result.architecture} />
      </div>
      <div className="section-block">
        <h3 className="sys">Control posture</h3>
        <p className="prose-sm mt-1">{result.controlPosture}</p>
        <ul className="control-list mt-2">
          {result.controlsRequired.map((control) => (
            <li key={control.id}>
              <b>{control.label}</b>
              <span>{control.rationale}</span>
            </li>
          ))}
        </ul>
      </div>
      {design.stepCount === 0 ? (
        <div className="section-block">
          <p className="hint">
            Add workflow steps on the left to unlock FMEA depth and go/no-go design gates.
          </p>
          <div className="toolbar mt-2">
            <button type="button" className="ink-btn" onClick={onFocusMap}>
              Jump to map
            </button>
            <button type="button" className="line-btn" onClick={onOpenGates}>
              View gates
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
