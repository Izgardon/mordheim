import { Agent } from "node:http";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

import { pwaOptions } from "./src/lib/pwa/pwa-options";

// The build's id: the commit Vercel builds, else when it was built. The phone's saved reads are
// thrown away when it changes (lib/offline/persist-options.ts), so a deploy never reads data saved
// in an older shape.
const APP_BUILD = process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`;

export default defineConfig({
  plugins: [
    react(),
    // The service worker, in a production build only (lib/pwa/). SW_SELF_DESTROY=1 builds the kill
    // switch instead: a sw.js that unregisters itself and empties its caches (docs/plans/offline.md).
    VitePWA({ ...pwaOptions, selfDestroying: process.env.SW_SELF_DESTROY === "1" }),
  ],
  define: {
    __APP_BUILD__: JSON.stringify(APP_BUILD),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@components": fileURLToPath(new URL("./src/components/ui", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    globals: true,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    proxy: {
      "/api": {
        // Compose's backend service; a cloud session's dev script points it at runserver on 127.0.0.1.
        target: process.env.API_PROXY_TARGET || "http://backend:8000",
        changeOrigin: true,
        // Reuse connections to the backend. A new connection looks `backend` up in DNS, which
        // waits in Node's 4-thread I/O pool behind the polling watcher's stats; on a Windows bind
        // mount that queue cost every API call 0.8-1.8 s.
        agent: new Agent({ keepAlive: true }),
      },
    },
  },
});
