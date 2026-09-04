import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadPrefs } from "./state/prefs";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./index.css";

const bootTheme = loadPrefs().theme;
document.documentElement.dataset.theme = bootTheme;
const themeMeta = document.querySelector('meta[name="theme-color"]');
if (themeMeta) {
  themeMeta.setAttribute("content", bootTheme === "carbon" ? "#09080c" : "#f1ece4");
}

// PWA plugin is off on Vercel (VERCEL=1). Keep this behind a static flag so the
// virtual module is tree-shaken out of CI builds.
if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_PWA === "true") {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
