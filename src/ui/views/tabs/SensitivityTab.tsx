import type { AssessmentInputs } from "@/domain/types";
import { analyzeSensitivity, applySensitivityMove } from "@/engine/sensitivity";
import { useMemo } from "react";

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function SensitivityTab({
  inputs,
  onProbe,
}: {
  inputs: AssessmentInputs;
  onProbe: (next: AssessmentInputs) => void;
}) {
  const rows = useMemo(() => analyzeSensitivity(inputs), [inputs]);

  return (
    <div>
      <p className="hint mt-3">
        Each dimension is moved one step in the direction that usually improves readiness, then the model is
        recomputed. Test in Scenario Lab does not change the current assessment until you adopt.
      </p>
      <h3 className="sys mt-3">
        Highest leverage
      </h3>
      <ul className="sense-list">
        {rows.map((row) => (
          <li key={row.key}>
            <b>{row.label}</b>
            <span>
              {`Fit ${signed(row.fitDelta)}${row.autonomyDelta ? ` · Autonomy ${signed(row.autonomyDelta)}` : ""}`}
            </span>
            <span>
              <span className="sys">{row.leverage}</span>
              {row.fitDelta !== 0 || row.autonomyDelta !== 0 ? (
                <button
                  type="button"
                  className="why-btn"
                  onClick={() => onProbe(applySensitivityMove(inputs, row.key))}
                >
                  Test in scenario
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
