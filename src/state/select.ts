const KEY = "agentfit.select.v1";

export function readSelected(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, 4);
  } catch {
    return [];
  }
}

export function writeSelected(ids: string[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids.slice(0, 4)));
  } catch {
    /* quota or private mode */
  }
}

export function clearSelected(): void {
  sessionStorage.removeItem(KEY);
}
