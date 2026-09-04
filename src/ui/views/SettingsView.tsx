import type { AssessmentRecord } from "@/domain/types";
import {
  downloadText,
  exportWorkspace,
  parseIncoming,
  toCsv,
} from "@/persistence/io";
import { cycleTheme, themeName, type Theme } from "@/state/prefs";
import { useRef, useState } from "react";

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SettingsView({
  records,
  theme,
  onTheme,
  onImportAssessment,
  onImportWorkspace,
  onWipe,
}: {
  records: AssessmentRecord[];
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onImportAssessment: (record: AssessmentRecord) => Promise<void>;
  onImportWorkspace: (records: AssessmentRecord[]) => Promise<void>;
  onWipe: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setOk(null);
    setError(null);
    try {
      const parsed = parseIncoming(JSON.parse(await file.text()) as unknown);
      if (parsed.type === "assessment") {
        await onImportAssessment(parsed.record);
        setOk("Assessment imported as a new record. Nothing was overwritten.");
      } else {
        await onImportWorkspace(parsed.records);
        setOk(`Imported ${parsed.records.length} assessments as copies.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    }
  };

  return (
    <div className="sheet" style={{ maxWidth: 720 }}>
      <p className="sys">Workspace</p>
      <h1 className="fit-heading" style={{ marginTop: 8 }}>
        Data and privacy
      </h1>
      <p className="lede" style={{ marginTop: 16 }}>
        Your workflow assessments remain on this device unless you explicitly export them. There is no account
        and no telemetry.
      </p>
      <div className="section-block" style={{ marginTop: 8, borderTop: 0, paddingTop: 0 }}>
        <h2 className="fit-heading" style={{ fontSize: "1.2rem" }}>
          Appearance
        </h2>
        <p className="hint" style={{ marginTop: 8 }}>
          Split keeps porcelain inputs and carbon results. Carbon and porcelain are full-surface themes.
        </p>
        <div className="toolbar">
          {(["split", "carbon", "porcelain"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={theme === item ? "ink-btn" : "line-btn"}
              aria-pressed={theme === item}
              onClick={() => onTheme(item)}
            >
              {themeName(item)}
            </button>
          ))}
          <button type="button" className="line-btn" onClick={() => onTheme(cycleTheme(theme))}>
            Cycle
          </button>
        </div>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="ink-btn"
          onClick={() =>
            downloadText(`agentfit-workspace-${stamp()}.json`, JSON.stringify(exportWorkspace(records), null, 2))
          }
        >
          Export workspace
        </button>
        <button
          type="button"
          className="line-btn"
          onClick={() => downloadText(`agentfit-summary-${stamp()}.csv`, toCsv(records), "text/csv")}
        >
          Export CSV summary
        </button>
        <button type="button" className="line-btn" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
          event.target.value = "";
        }}
      />
      {ok ? <p className="hint" style={{ marginTop: 16 }}>{ok}</p> : null}
      {error ? (
        <p className="hint" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      ) : null}
      <p className="hint" style={{ marginTop: 24 }}>
        Import never silently overwrites. Existing IDs are copied. Unsaved work is kept as tab scratch until the
        tab closes.
      </p>
      <div className="section-block">
        <h2 className="fit-heading" style={{ fontSize: "1.2rem" }}>
          Clear this device
        </h2>
        <p className="hint" style={{ marginTop: 8 }}>
          Removes every assessment from IndexedDB on this browser. Export first if you may need the work.
        </p>
        <div className="toolbar">
          <button type="button" className="line-btn" onClick={onWipe}>
            Delete all assessments
          </button>
        </div>
      </div>
    </div>
  );
}
