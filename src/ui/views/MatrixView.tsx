import type { AssessmentRecord, ReadinessLevel } from "@/domain/types";
import { PortfolioStrip } from "@/ui/components/PortfolioStrip";

const READINESS_X: Record<ReadinessLevel, number> = {
  "Not Ready": 0.12,
  "Discovery Ready": 0.38,
  "Pilot Ready": 0.68,
  "Production Candidate": 0.9,
};

export function MatrixView({
  records,
  onOpen,
  onAssess,
}: {
  records: AssessmentRecord[];
  onOpen: (id: string) => void;
  onAssess: () => void;
}) {
  const live = records.filter((record) => !record.archived);

  return (
    <div className="sheet">
      <p className="sys">Decision matrix</p>
      <h1 className="fit-heading" style={{ marginTop: 8 }}>
        Readiness × economic opportunity
      </h1>
      <p className="hint" style={{ marginTop: 8 }}>
        Marker size is risk pressure. Click a marker to open. Upper-right tends to Build Now; lower-left to Low
        Priority. The table is the accessible index.
      </p>
      <PortfolioStrip results={live.map((record) => record.result)} />
      {live.length === 0 ? (
        <div className="empty">
          <p>Save at least one assessment to plot the portfolio.</p>
          <div className="toolbar">
            <button type="button" className="ink-btn" onClick={onAssess}>
              Start assessment
            </button>
          </div>
        </div>
      ) : (
        <>
          <svg className="matrix" viewBox="0 0 800 420" role="img" aria-label="Portfolio matrix">
            <title>Readiness by economic opportunity</title>
            <rect x="64" y="24" width="700" height="350" fill="none" stroke="currentColor" opacity="0.18" />
            <line
              x1="64"
              y1="199"
              x2="764"
              y2="199"
              stroke="currentColor"
              strokeDasharray="3 5"
              opacity="0.12"
            />
            <line
              x1="414"
              y1="24"
              x2="414"
              y2="374"
              stroke="currentColor"
              strokeDasharray="3 5"
              opacity="0.12"
            />
            <text
              x="64"
              y="410"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="10"
              letterSpacing="1.4"
              fill="currentColor"
              opacity="0.5"
            >
              IMPLEMENTATION / READINESS →
            </text>
            <text
              x="18"
              y="374"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="10"
              letterSpacing="1.4"
              fill="currentColor"
              opacity="0.5"
              transform="rotate(-90 18 374)"
            >
              ECONOMIC OPPORTUNITY →
            </text>
            {live.map((record) => {
              const x = 64 + READINESS_X[record.result.readiness] * 700;
              const y = 374 - (record.result.breakdown.economicOpportunity / 20) * 350;
              const r = 5 + (1 - record.result.breakdown.riskSuitability / 15) * 10;
              const label = record.inputs.name.trim() || "Untitled";
              return (
                <g
                  key={record.id}
                  className="matrix-mark"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => onOpen(record.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpen(record.id);
                    }
                  }}
                >
                  <title>{`${label} · ${record.result.portfolioClass}`}</title>
                  <circle cx={x} cy={y} r={r + 8} fill="transparent" />
                  <circle cx={x} cy={y} r={r} fill="currentColor" opacity="0.85" />
                  <text
                    x={x + 10}
                    y={y + 4}
                    fontFamily="Schibsted Grotesk, sans-serif"
                    fontSize="11"
                    fill="currentColor"
                  >
                    {label.slice(0, 22)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="section-block">
            <p className="sys">Index</p>
            <div className="row head" style={{ gridTemplateColumns: "1.4fr 70px 1.1fr 1.2fr 1.6fr" }}>
              <span>Workflow</span>
              <span>Fit</span>
              <span>Class</span>
              <span>Autonomy</span>
              <span>Verdict</span>
            </div>
            {live.map((record) => (
              <div
                className="row"
                key={record.id}
                style={{ gridTemplateColumns: "1.4fr 70px 1.1fr 1.2fr 1.6fr" }}
              >
                <button type="button" className="link" onClick={() => onOpen(record.id)}>
                  {record.inputs.name.trim() || "Untitled"}
                </button>
                <span>{record.result.score}</span>
                <span>{record.result.portfolioClass}</span>
                <span>{record.result.autonomyLabel}</span>
                <span className="verdict-line hint">{record.result.verdict}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
