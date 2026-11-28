import type { VitePWAOptions } from "vite-plugin-pwa";
import type { RouteMatchCallbackOptions, WorkboxPlugin } from "workbox-core/types";

/*
 * The service worker (docs/plans/offline.md, phase 2): it serves the app's own files so an installed
 * app opens with no signal, and never touches the API, Pusher or any other site (phase 1 keeps the
 * reads in IndexedDB). vite.config.js builds it; it exists only in a production build.
 *
 * The functions below run inside the worker as their own source text (workbox-build copies them
 * into sw.js), so they may use nothing else from this file.
 */

/** A page of the app the browser opens (always the SPA's index.html), never an API path. */
export const isAppPage = ({ request, url, sameOrigin }: RouteMatchCallbackOptions) =>
  request.mode === "navigate" && sameOrigin && !url.pathname.startsWith("/api/");

/** One of the build's hashed files. */
export const isBuildFile = ({ url, sameOrigin }: RouteMatchCallbackOptions) =>
  sameOrigin && url.pathname.startsWith("/assets/");

/**
 * A page comes from the network first, so an online player always gets the newest deploy. When the
 * network fails or takes over 3 seconds, the page is this worker's precached index.html, whose
 * build files it holds; no page is stored on its own, so the shell and its files never mix builds.
 */
export const pagePlugin: WorkboxPlugin = {
  cacheWillUpdate: async () => null,
  cachedResponseWillBeUsed: async ({ cachedResponse }) =>
    cachedResponse ??
    (await caches
      .open(
        `workbox-precache-v2-${(self as unknown as { registration: ServiceWorkerRegistration }).registration.scope}`
      )
      .then((cache) => cache.match("/index.html", { ignoreSearch: true }))) ??
    null,
};

/**
 * A build file this worker didn't precache (a newer build loaded online before its worker took
 * over), kept as it's fetched. A missing file answers with the SPA's index.html: never kept.
 */
export const buildFilePlugin: WorkboxPlugin = {
  cacheWillUpdate: async ({ response }) =>
    response.status === 200 && !(response.headers.get("content-type") || "").includes("text/html")
      ? response
      : null,
};

export const pwaOptions: Partial<VitePWAOptions> = {
  strategies: "generateSW",
  // A new version waits until the player taps Reload on its notice or the app next starts cold
  // (lib/pwa/register-sw.ts): never a reload by itself, and the old build's files stay on the
  // phone while its page is open.
  registerType: "prompt",
  // registered from lib/pwa/start.ts: an inline script would break the CSP's script-src 'self'
  injectRegister: false,
  manifest: false, // public/manifest.webmanifest
  workbox: {
    // every hashed file, the shell and the icons; the fonts' Latin files only
    globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}", "assets/*-latin-*.woff2"],
    navigateFallback: null, // a page is network-first (pagePlugin), never the stored copy first
    directoryIndex: null, // so "/" isn't answered from the precache ahead of the network
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: false,
    inlineWorkboxRuntime: true, // one sw.js, served uncached (vercel.json)
    navigationPreload: true,
    runtimeCaching: [
      {
        urlPattern: isAppPage,
        handler: "NetworkFirst",
        options: { cacheName: "pages", networkTimeoutSeconds: 3, plugins: [pagePlugin] },
      },
      {
        urlPattern: isBuildFile,
        handler: "CacheFirst",
        options: {
          cacheName: "build-files",
          expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 },
          plugins: [buildFilePlugin],
        },
      },
    ],
  },
};
