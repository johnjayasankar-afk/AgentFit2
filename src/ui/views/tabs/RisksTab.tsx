import type { EvaluationResult, FmeaItem, RiskItem } from "@/domain/types";

export function RisksTab({
  result,
  risks,
  onChange,
  fmea,
  onFmea,
}: {
  result: EvaluationResult;
  risks: RiskItem[];
  onChange: (next: RiskItem[] | null) => void;
  fmea: FmeaItem[];
  onFmea: (next: FmeaItem[] | null) => void;
}) {
  return (
    <div>
      <p className="hint" style={{ marginTop: 16, color: "inherit", opacity: 0.55 }}>
        Risk register from scored inputs. FMEA from workflow steps, write systems, and risks — edit mitigations.
      </p>
      {risks.length === 0 ? (
        <p className="hint" style={{ marginTop: 12, color: "inherit", opacity: 0.55 }}>
          No material scored risks. Confirm inputs are not overly optimistic.
        </p>
      ) : (
        <ul className="risk-list">
          {risks.map((item, index) => (
            <li key={item.id}>
              <div>
                <b>{item.risk}</b>
                <div className="hint" style={{ color: "inherit", opacity: 0.5, marginTop: 4 }}>
                  {item.why}
                </div>
              </div>
              <label className="field" style={{ marginTop: 0 }}>
                <span className="sys">Mitigation</span>
                <input
                  type="text"
                  value={item.mitigation}
                  aria-label={`Mitigation for ${item.risk}`}
                  onChange={(event) => {
                    const next = risks.map((row, i) =>
                      i === index ? { ...row, mitigation: event.target.value } : row,
                    );
                    onChange(next);
                  }}
                />
              </label>
              <span className="sys">{`${item.severity}/5`}</span>
            </li>
          ))}
        </ul>
      )}
      {result.risks !== risks ? (
        <button type="button" className="why-btn" onClick={() => onChange(null)}>
          Restore generated mitigations
        </button>
      ) : null}

      <div className="section-block">
        <h3 className="sys">FMEA</h3>
        <p className="hint" style={{ marginTop: 8, color: "inherit", opacity: 0.5 }}>
          RPN = severity × occurrence × detection. Highest first.
        </p>
        {fmea.length === 0 ? (
          <p className="hint" style={{ marginTop: 10, color: "inherit", opacity: 0.55 }}>
            Map workflow steps and write systems to generate failure modes.
          </p>
        ) : (
          <ul className="fmea-list">
            {fmea.map((item, index) => (
              <li key={item.id}>
                <div>
                  <b>{item.failure}</b>
                  <span className="hint" style={{ display: "block", marginTop: 4, color: "inherit", opacity: 0.5 }}>
                    {`${item.cause} · ${item.effect}`}
                  </span>
                </div>
                <span className="sys">{`RPN ${item.rpn}`}</span>
                <span className="sys">{item.source}</span>
                <label className="field" style={{ marginTop: 0, gridColumn: "1 / -1" }}>
                  <span className="sys">Mitigation</span>
                  <input
                    type="text"
                    value={item.mitigation}
                    aria-label={`FMEA mitigation for ${item.failure}`}
                    onChange={(event) => {
                      const next = fmea.map((row, i) =>
                        i === index ? { ...row, mitigation: event.target.value } : row,
                      );
                      onFmea(next);
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
        {result.fmea !== fmea ? (
          <button type="button" className="why-btn" onClick={() => onFmea(null)}>
            Restore generated FMEA
          </button>
        ) : null}
      </div>
    </div>
  );
}
