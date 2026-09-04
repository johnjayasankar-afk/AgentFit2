import type { AssessmentRecord, PortfolioClass } from "@/domain/types";
import { PORTFOLIO_CLASSES } from "@/engine/compare";
import { PortfolioStrip } from "@/ui/components/PortfolioStrip";
import { relativeTime } from "@/util/time";
import { useMemo, useState } from "react";

type SortKey = "updated" | "fit" | "name" | "capacity";

const SORT_LABELS: Record<SortKey, string> = {
  updated: "Updated",
  fit: "Fit",
  name: "Name",
  capacity: "Capacity",
};

export function LibraryView({
  loading = false,
  records,
  currentId,
  onOpen,
  onDuplicate,
  onArchive,
  onDelete,
  onCompare,
  onAssess,
  selected,
  onToggleSelect,
}: {
  loading?: boolean;
  records: AssessmentRecord[];
  currentId?: string;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
  onCompare: () => void;
  onAssess: () => void;
  selected: string[];
  onToggleSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [showArchived, setShowArchived] = useState(false);
  const [klass, setKlass] = useState<PortfolioClass | "all">("all");

  const live = useMemo(() => records.filter((record) => showArchived || !record.archived), [records, showArchived]);

  const rows = useMemo(
    () =>
      live
        .filter((record) => {
          if (klass !== "all" && record.result.portfolioClass !== klass) return false;
          const hay =
            `${record.inputs.name} ${record.notes} ${record.inputs.archetype} ${record.result.autonomyLabel} ${record.result.pattern} ${record.result.portfolioClass} ${record.result.verdict}`.toLowerCase();
          return hay.includes(query.trim().toLowerCase());
        })
        .sort((a, b) => {
          if (sort === "fit") return b.result.score - a.result.score;
          if (sort === "capacity") return b.result.capacity.netCapacityReturned - a.result.capacity.netCapacityReturned;
          if (sort === "name") return a.inputs.name.localeCompare(b.inputs.name);
          return b.updatedAt.localeCompare(a.updatedAt);
        }),
    [live, query, sort, klass],
  );

  if (loading) {
    return (
      <div className="sheet">
        <p className="sys">Assessments</p>
        <h1 className="fit-heading" style={{ marginTop: 8 }}>
          Library
        </h1>
        <p className="hint" style={{ marginTop: 8 }}>
          Opening this device…
        </p>
      </div>
    );
  }

  return (
    <div className="sheet">
      <p className="sys">Assessments</p>
      <h1 className="fit-heading" style={{ marginTop: 8 }}>
        Library
      </h1>
      <p className="hint" style={{ marginTop: 8 }}>
        Stored on this device. Select 2–4 rows to compare.
        {selected.length >= 4 ? " Compare is full (4)." : ""}
      </p>
      <PortfolioStrip results={live.map((record) => record.result)} />
      <div className="toolbar">
        <input
          className="search"
          value={query}
          placeholder="Search workflows"
          aria-label="Search assessments"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="toolbar">
        <button
          type="button"
          className={klass === "all" ? "ink-btn" : "line-btn"}
          aria-pressed={klass === "all"}
          onClick={() => setKlass("all")}
        >
          All
        </button>
        {PORTFOLIO_CLASSES.map((item) => (
          <button
            key={item}
            type="button"
            className={klass === item ? "ink-btn" : "line-btn"}
            aria-pressed={klass === item}
            onClick={() => setKlass(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="toolbar">
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={sort === key ? "ink-btn" : "line-btn"}
            aria-pressed={sort === key}
            onClick={() => setSort(key)}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
        <button type="button" className="line-btn" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
        <button type="button" className="line-btn" disabled={selected.length < 2} onClick={onCompare}>
          {`Compare (${selected.length})`}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <p className="fit-heading">{live.length === 0 ? "No assessments yet." : "Nothing matches."}</p>
          <p className="hint" style={{ marginTop: 8 }}>
            {live.length === 0
              ? "Start an assessment or explore an example. Saved work will appear here."
              : "Clear the class filter or search."}
          </p>
          <div className="toolbar">
            {live.length === 0 ? (
              <button type="button" className="ink-btn" onClick={onAssess}>
                Start assessment
              </button>
            ) : (
              <button
                type="button"
                className="line-btn"
                onClick={() => {
                  setKlass("all");
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="row library-row head">
            <span>Workflow</span>
            <span>Fit</span>
            <span>Autonomy</span>
            <span>Readiness</span>
            <span>Capacity</span>
            <span>Updated</span>
          </div>
          {rows.map((record) => (
            <div
              className={record.id === currentId ? "row library-row current" : "row library-row"}
              key={record.id}
            >
              <div>
                <div className="library-name">
                  <input
                    type="checkbox"
                    checked={selected.includes(record.id)}
                    onChange={() => onToggleSelect(record.id)}
                    aria-label={`Select ${record.inputs.name || "untitled"} for compare`}
                  />
                  <button type="button" className="link" onClick={() => onOpen(record.id)}>
                    {record.inputs.name.trim() || "Untitled workflow"}
                    {record.demo ? <span className="hint"> · example</span> : null}
                    {record.archived ? <span className="hint"> · archived</span> : null}
                    {record.id === currentId ? <span className="hint"> · open</span> : null}
                  </button>
                </div>
                <span className="sys" style={{ display: "block", marginTop: 4, marginLeft: 22 }}>
                  {record.result.portfolioClass}
                </span>
                <span className="verdict-line hint" style={{ marginTop: 4, marginLeft: 22 }}>
                  {record.result.verdict}
                </span>
              </div>
              <span data-label="Fit">{record.result.score}</span>
              <span data-label="Autonomy">{record.result.autonomyLabel}</span>
              <span data-label="Readiness">{record.result.readiness}</span>
              <span data-label="Capacity">{`${record.result.capacity.netCapacityReturned}h`}</span>
              <div data-label="Updated">
                <span className="hint" title={new Date(record.updatedAt).toLocaleString()}>
                  {relativeTime(record.updatedAt)}
                </span>
                <div className="toolbar" style={{ margin: "6px 0 0" }}>
                  <button type="button" className="why-btn" onClick={() => onDuplicate(record.id)}>
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="why-btn"
                    onClick={() => onArchive(record.id, !record.archived)}
                  >
                    {record.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button type="button" className="why-btn" onClick={() => onDelete(record.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
