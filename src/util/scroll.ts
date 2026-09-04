/** Prefer instant scroll when the user asks for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function scrollToId(id: string, block: ScrollLogicalPosition = "start"): void {
  document.getElementById(id)?.scrollIntoView({ block, behavior: scrollBehavior() });
}
