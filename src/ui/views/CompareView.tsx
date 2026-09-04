import type { AssessmentRecord } from "@/domain/types";
import { sharedBlockers } from "@/engine/compare";
import { PortfolioStrip } from "@/ui/components/PortfolioStrip";

export function CompareView({
  records,
  onOpen,
  onLibrary,
}: {
  records: AssessmentRecord[];
  onOpen: (id: string) => void;
  onLibrary: () => void;
}) {
  if (records.length < 2) {
    return (
      <div className="sheet">
        <p className="sys">Compare</p>
        <h1 className="fit-heading" style={{ marginTop: 8 }}>
          Select 2–4 workflows
        </h1>
        <p className="hint" style={{ marginTop: 10 }}>
          Comparison is for portfolio prioritization. Open the library and select at least two saved assessments.
        </p>
        <div className="toolbar">
          <button type="button" className="ink-btn" onClick={onLibrary}>
            Open library
          </button>
        </div>
      </div>
    );
  }

  const shared = sharedBlockers(records.map((record) => record.result));

  return (
    <div className="sheet">
      <p className="sys">Compare</p>
      <h1 className="fit-heading" style={{ marginTop: 8 }}>
        Portfolio
      </h1>
      <p className="hint" style={{ marginTop: 8 }}>
        Agent Fit is not the same as autonomy. High value with weak controls is a de-risk problem. Highlighted
        cells mark the strongest numeric signal in the row.
      </p>
      <PortfolioStrip results={records.map((record) => record.result)} />
      <div className="compare-grid" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Signal</th>
              {records.map((record) => (
                <th key={record.id}>
                  <button type="button" className="link" onClick={() => onOpen(record.id)}>
                    {record.inputs.name.trim() || "Untitled"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CompareRow
              label="Agent Fit"
              cells={records.map((record) => String(record.result.score))}
              highlight="max"
            />
            <CompareRow
              label="Economic opportunity"
              cells={records.map((record) => String(record.result.breakdown.economicOpportunity))}
              highlight="max"
            />
            <CompareRow
              label="Technical readiness"
              cells={records.map((record) => String(record.result.breakdown.technicalReadiness))}
              highlight="max"
            />
            <CompareRow
              label="Risk suitability"
              cells={records.map((record) => String(record.result.breakdown.riskSuitability))}
              highlight="max"
            />
            <CompareRow label="Autonomy" cells={records.map((record) => record.result.autonomyLabel)} />
            <CompareRow label="Pattern" cells={records.map((record) => record.result.pattern)} />
            <CompareRow
              label="Capacity / week"
              cells={records.map((record) => `${record.result.capacity.netCapacityReturned} hrs`)}
              highlight="max"
            />
            <CompareRow label="Readiness" cells={records.map((record) => record.result.readiness)} />
            <CompareRow label="Classification" cells={records.map((record) => record.result.portfolioClass)} />
            <CompareRow label="Verdict" cells={records.map((record) => record.result.verdict)} />
            <CompareRow
              label="What caps autonomy"
              cells={records.map((record) => record.result.blockers[0]?.title ?? "—")}
            />
            <CompareRow label="Next experiment" cells={records.map((record) => record.result.experiment.title)} />
          </tbody>
        </table>
      </div>
      {shared.length > 0 ? (
        <div className="section-block">
          <p className="sys">Shared blockers</p>
          <ul className="explain">
            {shared.map((item) => (
              <li key={item.id}>
                <b>{item.title}</b>
                {` — in ${item.count} of ${records.length}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="section-block">
        <p className="sys">Classes</p>
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
      </div>
    </div>
  );
}

function CompareRow({
  label,
  cells,
  highlight,
}: {
  label: string;
  cells: string[];
  highlight?: "max" | "min";
}) {
  const nums = cells.map((cell) => {
    const match = cell.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : Number.NaN;
  });
  const valid = nums.filter((n) => !Number.isNaN(n));
  const target =
    highlight && valid.length > 1
      ? highlight === "max"
        ? Math.max(...valid)
        : Math.min(...valid)
      : null;

  return (
    <tr>
      <th>{label}</th>
      {cells.map((cell, i) => (
        <td key={`${label}-${i}`} className={target != null && nums[i] === target ? "best" : undefined}>
          {cell}
        </td>
      ))}
    </tr>
  );
}
