export type Theme = "split" | "carbon" | "porcelain";

const KEY = "agentfit.prefs.v1";

export interface Prefs {
  theme: Theme;
  seenWelcome: boolean;
  lastId: string | null;
}

const defaults: Prefs = {
  theme: "split",
  seenWelcome: false,
  lastId: null,
};

function isTheme(value: unknown): value is Theme {
  return value === "split" || value === "carbon" || value === "porcelain";
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...defaults };
    const rec = parsed as Record<string, unknown>;
    return {
      theme: isTheme(rec.theme) ? rec.theme : defaults.theme,
      seenWelcome: rec.seenWelcome === true,
      lastId: typeof rec.lastId === "string" ? rec.lastId : null,
    };
  } catch {
    return { ...defaults };
  }
}

export function savePrefs(prefs: Prefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function cycleTheme(theme: Theme): Theme {
  if (theme === "split") return "carbon";
  if (theme === "carbon") return "porcelain";
  return "split";
}

export function themeLabel(theme: Theme): string {
  if (theme === "split") return "Use carbon theme";
  if (theme === "carbon") return "Use porcelain theme";
  return "Use split theme";
}

export function themeName(theme: Theme): string {
  if (theme === "split") return "Split";
  if (theme === "carbon") return "Carbon";
  return "Porcelain";
}
