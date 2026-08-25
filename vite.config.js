import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.svg",
        "mrd-ai-logo.svg",
        "icons/apple-touch-icon.png",
      ],

      manifest: {
        name: "Mr.D AI Operations Platform",
        short_name: "Mr.D",

        description:
          "AI-powered operations, attendance and administration platform.",

        start_url: "/",
        scope: "/",

        display: "standalone",

        background_color: "#f4f7fb",
        theme_color: "#2563eb",

        orientation: "portrait-primary",

        icons: [
          {
            src: "/icons/mrd-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/mrd-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/mrd-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,

        maximumFileSizeToCacheInBytes:
          3 * 1024 * 1024,

        navigateFallback: "/index.html",

        globPatterns: [
          "**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff,woff2}",
        ],
      },
    }),
  ],
});
