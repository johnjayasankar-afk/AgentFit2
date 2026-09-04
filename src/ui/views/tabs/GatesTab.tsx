import type { EvaluationResult, GateStatus } from "@/domain/types";
import { gateTally } from "@/engine/gates";

const STATUS_LABEL: Record<GateStatus, string> = {
  pass: "Pass",
  warn: "Warn",
  fail: "Fail",
  unknown: "Unknown",
};

type FixTarget = "map" | "inventory" | "economics" | "diagnosis" | "design" | "risks" | "recommend";

export function GatesTab({
  result,
  onFix,
}: {
  result: EvaluationResult;
  onFix: (target: FixTarget) => void;
}) {
  const tally = gateTally(result.goNoGo);
  const decision =
    tally.fail > 0 ? "No-go for agent build funding" : tally.warn > 0 ? "Conditional go — de-risk first" : "Investigation go";

  return (
    <div>
      <div className="section-block lead">
        <h3 className="sys">Go / no-go</h3>
        <p className="therefore mt-1">{decision}</p>
        <p className="hint page-hint">
          {`${tally.pass} pass · ${tally.warn} warn · ${tally.fail} fail · ${tally.unknown} unknown. This checklist
          supports discovery funding — it does not authorize production deployment.`}
        </p>
        <div className="kpis mt-2">
          <div>
            <span>Pass</span>
            <strong>{tally.pass}</strong>
          </div>
          <div>
            <span>Warn</span>
            <strong>{tally.warn}</strong>
          </div>
          <div>
            <span>Fail</span>
            <strong className={tally.fail > 0 ? "gate-chip" : undefined} key={tally.fail}>
              {tally.fail}
            </strong>
          </div>
        </div>
      </div>
      <ul className="gate-list">
        {result.goNoGo.map((gate) => (
          <li key={gate.id} data-status={gate.status}>
            <span className="sys gate-status">{STATUS_LABEL[gate.status]}</span>
            <div>
              <b>{gate.label}</b>
              <span className="hint mt-1 block">{gate.detail}</span>
              {gate.fixHint && gate.fixTarget && (gate.status === "fail" || gate.status === "warn") ? (
                <button type="button" className="why-btn" onClick={() => onFix(gate.fixTarget!)}>
                  {gate.fixHint}
                </button>
              ) : null}
            </div>
            <span className="sys">{gate.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
