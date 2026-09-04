import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const embedBase = process.env.EMBED_BASE;
/** Vercel sets VERCEL=1. Skip workbox SW generation there — it is the recurring CI failure. */
const enablePwa = !embedBase && process.env.VERCEL !== "1";

export default defineConfig({
  base: embedBase || "/",
  define: {
    "import.meta.env.VITE_ENABLE_PWA": JSON.stringify(enablePwa ? "true" : "false"),
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(enablePwa
      ? [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg", "manifest.webmanifest"],
            minify: false,
            manifest: {
              name: "AgentFit",
              short_name: "AgentFit",
              description: "When should a workflow get an agent?",
              theme_color: "#f1ece4",
              background_color: "#f1ece4",
              display: "standalone",
              start_url: "/",
              scope: "/",
              icons: [
                {
                  src: "/favicon.svg",
                  sizes: "any",
                  type: "image/svg+xml",
                  purpose: "any maskable",
                },
              ],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,svg,woff2,webmanifest}"],
              navigateFallback: "/index.html",
              maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
              mode: "development",
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
