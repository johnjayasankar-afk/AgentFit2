import { MODEL_LABEL, SHELL_VERSION } from "@/domain/model";
import {
  ARCHETYPE_DEFAULTS,
  EXAMPLE_KEYS,
  applyArchetype,
  cloneInputs,
} from "@/data/presets";
import type { AppView, AssessmentInputs, AssessmentRecord, ResultTab, WorkflowArchetype } from "@/domain/types";
import { defaultAssumptions, isDefaultAssumptions } from "@/engine/economics";
import { evaluate } from "@/engine/evaluate";
import {
  archiveRecord,
  createRecord,
  db,
  deleteRecord,
  duplicateRecord,
  getRecord,
  hydrateRecord,
  listRecords,
  saveRecord,
  wipeAll,
} from "@/persistence/db";
import { downloadText, exportAssessment, importAssessment, importWorkspace } from "@/persistence/io";
import { briefText } from "@/engine/brief";
import { hashForView, parseHash, RESULT_TABS } from "@/state/hash";
import { cycleTheme, loadPrefs, savePrefs, themeLabel, themeName, type Prefs } from "@/state/prefs";
import { clearSelected, readSelected, writeSelected } from "@/state/select";
import { clearScratch, readScratch, writeScratch } from "@/state/scratch";
import { CommandPalette, type CommandItem } from "@/ui/components/CommandPalette";
import { ConfirmDialog } from "@/ui/components/ConfirmDialog";
import { AssessForm } from "@/ui/views/AssessForm";
import { CompareView } from "@/ui/views/CompareView";
import { LibraryView } from "@/ui/views/LibraryView";
import { MatrixView } from "@/ui/views/MatrixView";
import { MethodologyView } from "@/ui/views/MethodologyView";
import { ResultsPanel } from "@/ui/views/ResultsPanel";
import { SettingsView } from "@/ui/views/SettingsView";
import { WelcomeView } from "@/ui/views/WelcomeView";
import { modKey } from "@/util/mod";
import { scrollToId } from "@/util/scroll";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const bootPrefs = loadPrefs();
const bootScratch = readScratch();
const bootRoute = parseHash();

function exportName(name: string): string {
  return `${(name || "assessment").replace(/\s+/g, "-").toLowerCase()}.json`;
}

function initialView(): AppView {
  return bootRoute.view ?? (bootPrefs.seenWelcome ? "assess" : "welcome");
}

function typingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function diagnosisSignature(inputs: AssessmentInputs): string {
  return JSON.stringify({
    archetype: inputs.archetype,
    economics: inputs.economics,
    structure: inputs.structure,
    systems: inputs.systems,
    risk: inputs.risk,
    humanLoop: inputs.humanLoop,
    workflow: inputs.workflow,
    inventory: inputs.inventory,
  });
}

type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

export default function App() {
  const [view, setView] = useState<AppView>(initialView);
  const [resultTab, setResultTab] = useState<ResultTab>(bootRoute.tab ?? "recommendation");
  const [prefs, setPrefs] = useState<Prefs>(bootPrefs);
  const [draft, setDraft] = useState<AssessmentRecord>(() => bootScratch?.record ?? createRecord());
  const [dirty, setDirty] = useState(() => bootScratch?.dirty ?? false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [selected, setSelected] = useState<string[]>(readSelected);
  const recordsQuery = useLiveQuery(() => listRecords(), []);
  const records = recordsQuery ?? [];
  const selectedIds = useMemo(() => {
    if (!recordsQuery) return selected;
    const ids = new Set(recordsQuery.map((record) => record.id));
    return selected.filter((id) => ids.has(id));
  }, [recordsQuery, selected]);
  const dirtyRef = useRef(false);
  const editEpochRef = useRef(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const mod = useMemo(() => modKey(), []);
  const viewRef = useRef(view);
  const tabRef = useRef(resultTab);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    tabRef.current = resultTab;
  }, [resultTab]);

  const persistPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const applyTheme = useCallback(
    (next: Prefs["theme"]) => {
      document.documentElement.dataset.theme = next;
      persistPrefs({ theme: next });
    },
    [persistPrefs],
  );

  const flash = useCallback((message: string) => {
    setToast(message);
  }, []);

  const show = useCallback(
    (next: AppView) => {
      setView(next);
      setCommandOpen(false);
      if (next !== "welcome") persistPrefs({ seenWelcome: true });
    },
    [persistPrefs],
  );

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    editEpochRef.current += 1;
    setDirty(true);
  }, []);

  const markClean = useCallback(() => {
    dirtyRef.current = false;
    setDirty(false);
  }, []);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const next = hashForView(view, view === "assess" ? resultTab : null);
    const current = window.location.hash || "#";
    if (current === next) return;
    if (view === "welcome" && (window.location.hash === "" || window.location.hash === "#")) return;
    const url = next === "#" ? `${window.location.pathname}${window.location.search}` : next;
    history.replaceState(null, "", url);
  }, [view, resultTab]);

  useEffect(() => {
    if (bootScratch) return;
    const id = bootPrefs.lastId;
    if (!id) return;
    let live = true;
    void getRecord(id).then((stored) => {
      if (!live || !stored || dirtyRef.current) return;
      setDraft(stored);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => writeScratch(draft, dirty), 280);
    return () => window.clearTimeout(handle);
  }, [draft, dirty]);

  useEffect(() => {
    writeSelected(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    const name = draft.inputs.name.trim();
    const titles: Record<AppView, string> = {
      welcome: "AgentFit — when should a workflow get an agent?",
      assess: name ? `${name} · AgentFit` : "Assess · AgentFit",
      library: "Library · AgentFit",
      compare: "Compare · AgentFit",
      matrix: "Matrix · AgentFit",
      methodology: "Method · AgentFit",
      settings: "Data · AgentFit",
    };
    document.title = titles[view];
  }, [view, draft.inputs.name]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", prefs.theme === "carbon" ? "#09080c" : "#f1ece4");
  }, [prefs.theme]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-overlay", commandOpen || Boolean(confirm));
  }, [commandOpen, confirm]);

  useEffect(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [toast]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const result = useMemo(() => evaluate(draft.inputs, draft.assumptions), [draft.inputs, draft.assumptions]);

  const save = useCallback(async () => {
    const current = draftRef.current;
    const epoch = editEpochRef.current;
    const named = current.inputs.name.trim() || "Untitled workflow";
    const record = {
      ...current,
      inputs: { ...current.inputs, name: named },
      result: evaluate(current.inputs, current.assumptions),
    };
    try {
      await saveRecord(record);
      persistPrefs({ lastId: record.id, seenWelcome: true });
      flash(current.inputs.name.trim() ? "Saved on this device" : "Saved as Untitled workflow");
      if (editEpochRef.current !== epoch || draftRef.current !== current) return;
      const stored = await db.assessments.get(record.id);
      if (editEpochRef.current !== epoch || draftRef.current !== current) return;
      if (stored) setDraft(hydrateRecord(stored));
      markClean();
    } catch {
      flash("Could not save on this device");
    }
  }, [persistPrefs, flash, markClean]);

  const fresh = useCallback(() => {
    const next = createRecord();
    setDraft(next);
    markClean();
    setResultTab("recommendation");
    show("assess");
    persistPrefs({ lastId: null });
  }, [persistPrefs, show, markClean]);

  const loadExample = useCallback((key: WorkflowArchetype = "payment_exception") => {
    const record = createRecord({ inputs: cloneInputs(ARCHETYPE_DEFAULTS[key]), demo: true });
    setDraft(record);
    markDirty();
    show("assess");
    setResultTab("recommendation");
  }, [show, markDirty]);

  const openRecord = useCallback(async (id: string) => {
    const stored = await getRecord(id);
    if (!stored) {
      flash("That assessment is no longer on this device");
      return;
    }
    setDraft(stored);
    markClean();
    show("assess");
    persistPrefs({ lastId: stored.id });
  }, [flash, persistPrefs, show, markClean]);

  const guard = useCallback((action: () => void) => {
    if (!dirtyRef.current) {
      action();
      return;
    }
    setConfirm({
      title: "Leave unsaved assessment?",
      body: "Edits live in this tab until you save. Continue and they stay only as scratch until the tab closes, or cancel and save first.",
      confirmLabel: "Continue",
      onConfirm: () => {
        setConfirm(null);
        action();
      },
    });
  }, []);

  const requestView = useCallback(
    (next: AppView) => {
      if (next === viewRef.current) return;
      guard(() => show(next));
    },
    [guard, show],
  );

  useEffect(() => {
    const revertHash = () => {
      const next = hashForView(viewRef.current, viewRef.current === "assess" ? tabRef.current : null);
      const url = next === "#" ? `${window.location.pathname}${window.location.search}` : next;
      history.replaceState(null, "", url);
    };
    const onHash = () => {
      const parsed = parseHash();
      const seen = loadPrefs().seenWelcome;
      const empty = window.location.hash === "" || window.location.hash === "#";
      const nextView = parsed.view ?? (empty ? (seen ? "assess" : "welcome") : null);
      const apply = () => {
        if (nextView) show(nextView);
        if (parsed.tab && nextView === "assess") setResultTab(parsed.tab);
      };
      if (!nextView) return;
      if (nextView === viewRef.current) {
        if (parsed.tab && nextView === "assess") setResultTab(parsed.tab);
        return;
      }
      if (dirtyRef.current) {
        revertHash();
        guard(apply);
        return;
      }
      apply();
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [guard, show]);

  const requestOpen = useCallback(
    (id: string) => {
      if (id === draft.id) {
        show("assess");
        return;
      }
      guard(() => {
        void openRecord(id);
      });
    },
    [draft.id, guard, openRecord, show],
  );

  const exportCurrent = useCallback(() => {
    downloadText(exportName(draft.inputs.name), JSON.stringify(exportAssessment({ ...draft, result }), null, 2));
  }, [draft, result]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const chord = event.metaKey || event.ctrlKey;
      const typing = typingInField(event.target);

      if (confirm) {
        if (event.key === "Escape") {
          event.preventDefault();
          setConfirm(null);
        }
        return;
      }

      if (chord && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        return;
      }
      if (chord && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (commandOpen) return;
      if (typing) return;
      if (chord && event.key.toLowerCase() === "n") {
        event.preventDefault();
        guard(fresh);
        return;
      }
      if (chord && event.key.toLowerCase() === "l") {
        event.preventDefault();
        requestView("library");
        return;
      }
      if (chord && event.key.toLowerCase() === "e") {
        event.preventDefault();
        exportCurrent();
        return;
      }
      if (!chord && (event.key === "?" || (event.shiftKey && event.key === "/"))) {
        event.preventDefault();
        requestView("methodology");
        return;
      }
      if (!chord && view === "assess" && !commandOpen) {
        if (event.key.toLowerCase() === "g") {
          event.preventDefault();
          setResultTab("gates");
          return;
        }
        const index = Number(event.key) - 1;
        if (index >= 0 && index < RESULT_TABS.length) {
          event.preventDefault();
          setResultTab(RESULT_TABS[index]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, fresh, guard, requestView, exportCurrent, view, commandOpen, confirm]);

  const commands: CommandItem[] = [
    { id: "new", label: "New assessment", hint: `${mod}N`, run: () => guard(fresh) },
    { id: "save", label: "Save assessment", hint: `${mod}S`, run: () => { void save(); } },
    { id: "library", label: "Open assessments", hint: `${mod}L`, run: () => requestView("library") },
    { id: "compare", label: "Compare", run: () => requestView("compare") },
    { id: "matrix", label: "Decision matrix", run: () => requestView("matrix") },
    { id: "method", label: "Open methodology", run: () => requestView("methodology") },
    { id: "settings", label: "Workspace / export", run: () => requestView("settings") },
    { id: "export", label: "Export current JSON", hint: `${mod}E`, run: exportCurrent },
    {
      id: "brief-export",
      label: "Export decision brief",
      run: () =>
        downloadText(
          `${exportName(draft.inputs.name).replace(/\.json$/, "")}-brief.txt`,
          briefText(draft.inputs, result, {
            notes: draft.notes,
            successCriteria: draft.editedSuccessCriteria ?? result.experiment.successCriteria,
            risks: draft.editedRisks ?? result.risks,
            fmea: draft.editedFmea ?? result.fmea,
          }),
          "text/plain",
        ),
    },
    {
      id: "copy-verdict",
      label: "Copy verdict",
      run: () => {
        void navigator.clipboard.writeText(result.verdict).then(
          () => flash("Verdict copied"),
          () => flash("Could not copy"),
        );
      },
    },
    { id: "thesis", label: "Show thesis", run: () => requestView("welcome") },
    { id: "method-keys", label: "Keyboard & method", hint: "?", run: () => requestView("methodology") },
    {
      id: "theme",
      label: themeLabel(prefs.theme),
      hint: themeName(prefs.theme),
      run: () => applyTheme(cycleTheme(prefs.theme)),
    },
    ...records
      .filter((record) => !record.archived)
      .slice(0, 6)
      .map((record) => ({
        id: `open-${record.id}`,
        label: `Open · ${record.inputs.name.trim() || "Untitled"}`,
        run: () => requestOpen(record.id),
      })),
    ...EXAMPLE_KEYS.map((key) => ({
      id: `ex-${key}`,
      label: `Example · ${ARCHETYPE_DEFAULTS[key].name}`,
      run: () => guard(() => loadExample(key)),
    })),
  ];

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="app-shell" {...(commandOpen || confirm ? { inert: true } : {})}>
      <header className="header">
        {import.meta.env.BASE_URL !== "/" ? (
          <a className="host-back" href="/">
            John Jayasankar
          </a>
        ) : null}
        <button
          type="button"
          className="brand"
          onClick={() => requestView(prefs.seenWelcome || view !== "welcome" ? "assess" : "welcome")}
        >
          <b>AgentFit</b>
          <span>When should a workflow get an agent?</span>
        </button>
        <nav className="nav" aria-label="Primary">
          <Nav id="assess" view={view} setView={requestView} label="Assess" />
          <Nav id="library" view={view} setView={requestView} label="Library" />
          <Nav id="compare" view={view} setView={requestView} label="Compare" />
          <Nav id="matrix" view={view} setView={requestView} label="Matrix" />
          <Nav id="methodology" view={view} setView={requestView} label="Method" />
          <Nav id="settings" view={view} setView={requestView} label="Data" />
          <button
            type="button"
            className="cmd-btn"
            title={`Theme · ${themeName(prefs.theme)}`}
            aria-label={`Cycle theme. Current: ${themeName(prefs.theme)}`}
            onClick={() => applyTheme(cycleTheme(prefs.theme))}
          >
            {themeName(prefs.theme)}
          </button>
          <button type="button" className="cmd-btn" aria-label="Open command palette" onClick={() => setCommandOpen(true)}>
            {`${mod}K`}
          </button>
        </nav>
      </header>
      <main id="main" className="main" tabIndex={-1}>
        {view === "welcome" ? (
          <WelcomeView
            savedCount={records.filter((record) => !record.archived).length}
            lastName={draft.inputs.name}
            recent={records
              .filter((record) => !record.archived)
              .slice(0, 3)
              .map((record) => ({
                id: record.id,
                name: record.inputs.name.trim() || "Untitled workflow",
                klass: record.result.portfolioClass,
              }))}
            onResume={() => show("assess")}
            onOpenRecent={(id) => requestOpen(id)}
            onStart={() => {
              persistPrefs({ seenWelcome: true });
              show("assess");
            }}
            onNew={() => {
              persistPrefs({ seenWelcome: true });
              guard(fresh);
            }}
            onExample={() => {
              persistPrefs({ seenWelcome: true });
              guard(() => loadExample("support_triage"));
            }}
          />
        ) : null}
        {view === "assess" ? (
          <>
            <div className="sheet" style={{ paddingBottom: 0 }}>
              <div className="toolbar">
                <button type="button" className="ink-btn" onClick={() => { void save(); }}>
                  Save
                  {dirty ? <i className="dirty-dot" /> : null}
                </button>
                <button type="button" className="line-btn" onClick={() => guard(fresh)}>
                  New
                </button>
                <button type="button" className="line-btn" onClick={exportCurrent}>
                  Export JSON
                </button>
                <span className="hint">
                  {`${draft.demo ? "Example · starting point" : dirty ? "Unsaved" : "Saved"} · ${result.portfolioClass} · ${result.modelLabel}`}
                </span>
              </div>
            </div>
            <div className="fit-shell">
              <section className="fit-panel">
                <AssessForm
                  inputs={draft.inputs}
                  notes={draft.notes}
                  onChange={(inputs) => {
                    setDraft((current) => {
                      if (diagnosisSignature(inputs) === diagnosisSignature(current.inputs)) {
                        return { ...current, inputs };
                      }
                      const prevAutonomy = evaluate(current.inputs).autonomy;
                      const nextAutonomy = evaluate(inputs).autonomy;
                      const assumptions =
                        nextAutonomy !== prevAutonomy && isDefaultAssumptions(current.assumptions, prevAutonomy)
                          ? defaultAssumptions(nextAutonomy)
                          : current.assumptions;
                      return {
                        ...current,
                        inputs,
                        assumptions,
                        editedSuccessCriteria: null,
                        editedRisks: null,
                        editedFmea: null,
                      };
                    });
                    markDirty();
                  }}
                  onNotes={(notes) => {
                    setDraft((current) => ({ ...current, notes }));
                    markDirty();
                  }}
                  onArchetype={(archetype) => {
                    if (archetype === draft.inputs.archetype) return;
                    const apply = () => {
                      const next = applyArchetype(archetype, draft.inputs.name);
                      const assumptions = defaultAssumptions(evaluate(next).autonomy);
                      setDraft((current) => ({
                        ...current,
                        inputs: next,
                        assumptions,
                        scenarioInputs: null,
                        editedSuccessCriteria: null,
                        editedRisks: null,
                        editedFmea: null,
                        editedPilot: null,
                        demo: false,
                      }));
                      markDirty();
                      setResultTab("recommendation");
                    };
                    setConfirm({
                      title: "Replace diagnosis with archetype defaults?",
                      body: "This replaces scores, workflow map, and systems inventory with the archetype starting point. Scenario Lab and edited criteria / risks / FMEA are cleared. Your workflow name and notes are kept.",
                      confirmLabel: "Apply archetype",
                      onConfirm: () => {
                        setConfirm(null);
                        apply();
                      },
                    });
                  }}
                />
              </section>
              <section className="fit-panel dark">
                <ResultsPanel
                  result={result}
                  inputs={draft.inputs}
                  notes={draft.notes}
                  assumptions={draft.assumptions}
                  scenarioInputs={draft.scenarioInputs}
                  onAssumptions={(patch) => {
                    setDraft((current) => ({
                      ...current,
                      assumptions: { ...current.assumptions, ...patch },
                    }));
                    markDirty();
                  }}
                  onScenario={(scenarioInputs) => {
                    setDraft((current) => ({ ...current, scenarioInputs }));
                    markDirty();
                  }}
                  onClearScenario={() => {
                    setDraft((current) => ({ ...current, scenarioInputs: null }));
                    markDirty();
                  }}
                  onAdoptScenario={() => {
                    setDraft((current) => {
                      if (!current.scenarioInputs) return current;
                      const assumptions = defaultAssumptions(evaluate(current.scenarioInputs).autonomy);
                      return {
                        ...current,
                        inputs: current.scenarioInputs,
                        scenarioInputs: null,
                        assumptions,
                        editedSuccessCriteria: null,
                        editedRisks: null,
                        editedFmea: null,
                        editedPilot: null,
                      };
                    });
                    markDirty();
                    setResultTab("recommendation");
                    flash("Scenario adopted as current");
                  }}
                  onProbe={(next) => {
                    const replace = () => {
                      setDraft((current) => ({ ...current, scenarioInputs: next }));
                      markDirty();
                      setResultTab("scenario");
                      flash("Probed in Scenario Lab");
                    };
                    if (draft.scenarioInputs) {
                      setConfirm({
                        title: "Replace Scenario Lab probe?",
                        body: "A scenario is already loaded. Continue and replace it with this sensitivity probe.",
                        confirmLabel: "Replace scenario",
                        onConfirm: () => {
                          setConfirm(null);
                          replace();
                        },
                      });
                      return;
                    }
                    replace();
                  }}
                  onCopyVerdict={() => {
                    void navigator.clipboard.writeText(result.verdict).then(
                      () => flash("Verdict copied"),
                      () => flash("Could not copy"),
                    );
                  }}
                  tab={resultTab}
                  onTab={setResultTab}
                  successCriteria={draft.editedSuccessCriteria ?? result.experiment.successCriteria}
                  onSuccessCriteria={(editedSuccessCriteria) => {
                    setDraft((current) => ({ ...current, editedSuccessCriteria }));
                    markDirty();
                  }}
                  risks={draft.editedRisks ?? result.risks}
                  onRisks={(editedRisks) => {
                    setDraft((current) => ({ ...current, editedRisks }));
                    markDirty();
                  }}
                  fmea={draft.editedFmea ?? result.fmea}
                  onFmea={(editedFmea) => {
                    setDraft((current) => ({ ...current, editedFmea }));
                    markDirty();
                  }}
                  onFocusAssess={(anchor) => {
                    const id =
                      anchor === "define"
                        ? "assess-define"
                        : anchor === "map"
                          ? "assess-map"
                          : anchor === "inventory"
                            ? "assess-inventory"
                            : anchor === "economics"
                              ? "assess-economics"
                              : "assess-diagnosis";
                    scrollToId(id);
                  }}
                />
              </section>
            </div>
          </>
        ) : null}
        {view === "library" ? (
          <LibraryView
            loading={recordsQuery === undefined}
            records={records}
            currentId={draft.id}
            onOpen={requestOpen}
            onAssess={() => show("assess")}
            onDuplicate={(id) => {
              guard(() => {
                void (async () => {
                  const copy = await duplicateRecord(id);
                  if (copy) {
                    flash("Duplicated");
                    await openRecord(copy.id);
                  }
                })();
              });
            }}
            onArchive={async (id, archived) => {
              await archiveRecord(id, archived);
              flash(archived ? "Archived" : "Unarchived");
            }}
            onDelete={(id) =>
              setConfirm({
                title: "Delete this assessment?",
                body: "This cannot be undone. Export first if you may need it later.",
                confirmLabel: "Delete",
                onConfirm: async () => {
                  await deleteRecord(id);
                  if (draft.id === id) fresh();
                  setSelected((ids) => ids.filter((item) => item !== id));
                  setConfirm(null);
                  flash("Deleted");
                },
              })
            }
            onCompare={() => requestView("compare")}
            selected={selectedIds}
            onToggleSelect={(id) => {
              setSelected((ids) => {
                const live = recordsQuery
                  ? ids.filter((item) => recordsQuery.some((record) => record.id === item))
                  : ids;
                if (live.includes(id)) return live.filter((item) => item !== id);
                if (live.length >= 4) {
                  queueMicrotask(() => flash("Compare holds four workflows"));
                  return live;
                }
                return [...live, id];
              });
            }}
          />
        ) : null}
        {view === "compare" ? (
          <CompareView
            records={records.filter((record) => selectedIds.includes(record.id))}
            onOpen={requestOpen}
            onLibrary={() => requestView("library")}
          />
        ) : null}
        {view === "matrix" ? (
          <MatrixView
            records={records}
            onOpen={requestOpen}
            onAssess={() => show("assess")}
          />
        ) : null}
        {view === "methodology" ? <MethodologyView /> : null}
        {view === "settings" ? (
          <SettingsView
            records={records}
            theme={prefs.theme}
            onTheme={(next) => applyTheme(next)}
            onImportAssessment={async (record) => {
              await importAssessment(record, "copy");
              show("library");
            }}
            onImportWorkspace={async (incoming) => {
              await importWorkspace(incoming);
              show("library");
            }}
            onWipe={() =>
              setConfirm({
                title: "Delete every assessment on this device?",
                body: "IndexedDB, session scratch, and the last-opened pointer will be cleared. Export a workspace first if you may need it.",
                confirmLabel: "Delete all",
                onConfirm: async () => {
                  await wipeAll();
                  clearScratch();
                  clearSelected();
                  persistPrefs({ lastId: null });
                  setSelected([]);
                  setDraft(createRecord());
                  markClean();
                  setConfirm(null);
                  flash("This device is clear");
                },
              })
            }
          />
        ) : null}
      </main>
      <footer className="status-bar" aria-label="Workspace status">
        <span>
          {dirty
            ? "Unsaved"
            : draft.updatedAt
              ? "Saved"
              : "Local draft"}
          {result.completeness < 0.7
            ? ` · sketch ${Math.round(result.completeness * 100)}%`
            : " · complete"}
          {` · gates ${result.goNoGo.filter((g) => g.status === "fail").length}F/${result.goNoGo.filter((g) => g.status === "warn").length}W`}
        </span>
        <span>{`Shell ${SHELL_VERSION} · ${MODEL_LABEL} · no telemetry`}</span>
      </footer>
      </div>
      <CommandPalette open={commandOpen} items={commands} onClose={() => setCommandOpen(false)} />
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            void confirm.onConfirm();
          }}
        />
      ) : null}
    </div>
  );
}

function Nav({
  id,
  view,
  setView,
  label,
}: {
  id: AppView;
  view: AppView;
  setView: (view: AppView) => void;
  label: string;
}) {
  const current = view === id;
  return (
    <button
      type="button"
      className={current ? "on" : ""}
      aria-current={current ? "page" : undefined}
      onClick={() => setView(id)}
    >
      {label}
    </button>
  );
}
