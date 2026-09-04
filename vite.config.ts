import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const embedBase = process.env.EMBED_BASE;

export default defineConfig({
  base: embedBase || "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: Boolean(embedBase),
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      // Avoid workbox+terser early-exit failures on constrained CI (Vercel).
      minify: false,
      manifest: {
        name: "AgentFit",
        short_name: "AgentFit",
        description: "When should a workflow get an agent?",
        theme_color: "#f1ece4",
        background_color: "#f1ece4",
        display: "standalone",
        start_url: embedBase || "/",
        scope: embedBase || "/",
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
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: `${embedBase || "/"}index.html`.replace("//index", "/index"),
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Skip terser minify of the generated SW — the failure mode on Vercel CI.
        mode: "development",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
