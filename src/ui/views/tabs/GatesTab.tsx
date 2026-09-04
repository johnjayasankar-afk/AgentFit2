import type { EvaluationResult, GateStatus } from "@/domain/types";
import { gateTally } from "@/engine/gates";

const STATUS_LABEL: Record<GateStatus, string> = {
  pass: "Pass",
  warn: "Warn",
  fail: "Fail",
  unknown: "Unknown",
};

export function GatesTab({ result }: { result: EvaluationResult }) {
  const tally = gateTally(result.goNoGo);
  const decision =
    tally.fail > 0 ? "No-go for agent build funding" : tally.warn > 0 ? "Conditional go — de-risk first" : "Investigation go";

  return (
    <div>
      <div className="section-block" style={{ marginTop: 8, borderTop: 0, paddingTop: 8 }}>
        <h3 className="sys">Go / no-go</h3>
        <p className="therefore" style={{ marginTop: 8 }}>
          {decision}
        </p>
        <p className="hint" style={{ marginTop: 8, color: "inherit", opacity: 0.55 }}>
          {`${tally.pass} pass · ${tally.warn} warn · ${tally.fail} fail · ${tally.unknown} unknown. This checklist
          supports discovery funding — it does not authorize production deployment.`}
        </p>
        <div className="kpis" style={{ marginTop: 12 }}>
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
            <strong>{tally.fail}</strong>
          </div>
        </div>
      </div>
      <ul className="gate-list">
        {result.goNoGo.map((gate) => (
          <li key={gate.id} data-status={gate.status}>
            <span className="sys gate-status">{STATUS_LABEL[gate.status]}</span>
            <div>
              <b>{gate.label}</b>
              <span className="hint" style={{ display: "block", marginTop: 4, color: "inherit", opacity: 0.55 }}>
                {gate.detail}
              </span>
            </div>
            <span className="sys">{gate.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
