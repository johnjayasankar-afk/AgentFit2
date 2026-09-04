import type { AppView, ResultTab } from "@/domain/types";

const VIEWS: AppView[] = [
  "welcome",
  "assess",
  "library",
  "compare",
  "matrix",
  "methodology",
  "settings",
];

export const RESULT_TABS: ResultTab[] = [
  "recommendation",
  "design",
  "scenario",
  "sensitivity",
  "pilot",
  "risks",
  "gates",
  "brief",
];

function viewFromId(id: string): AppView | null {
  if (id === "method") return "methodology";
  if (id === "data") return "settings";
  return VIEWS.includes(id as AppView) ? (id as AppView) : null;
}

export function parseHash(hash = window.location.hash): { view: AppView | null; tab: ResultTab | null } {
  const path = hash.replace(/^#/, "").split("?")[0];
  if (!path) return { view: null, tab: null };
  const [id, tabPart] = path.split("/");
  const view = viewFromId(id);
  const tab = RESULT_TABS.includes(tabPart as ResultTab) ? (tabPart as ResultTab) : null;
  return { view, tab };
}

export function viewFromHash(hash = window.location.hash): AppView | null {
  return parseHash(hash).view;
}

export function hashForView(view: AppView, tab?: ResultTab | null): string {
  if (view === "welcome") return "#";
  if (view === "methodology") return "#method";
  if (view === "settings") return "#data";
  if (view === "assess" && tab && tab !== "recommendation") return `#assess/${tab}`;
  return `#${view}`;
}
