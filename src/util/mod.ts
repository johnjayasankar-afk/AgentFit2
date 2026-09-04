/** Platform-aware modifier label for shortcuts (⌘ on Apple, Ctrl elsewhere). */
export function modKey(): string {
  if (typeof navigator === "undefined") return "⌘";
  const apple =
    /Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
    /Mac OS X/.test(navigator.userAgent);
  return apple ? "⌘" : "Ctrl+";
}
