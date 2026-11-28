import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouteMatchCallbackOptions } from "workbox-core/types";

import { buildFilePlugin, isAppPage, isBuildFile, pagePlugin, pwaOptions } from "./pwa-options";

const APP = "https://app.test";

/** What workbox hands a route's match callback, for a request of `mode` to `href`. */
const match = (href: string, mode: RequestMode = "cors") => {
  const url = new URL(href);
  return {
    url,
    request: { mode } as Request,
    sameOrigin: url.origin === APP,
  } as RouteMatchCallbackOptions;
};

/** The function as the worker gets it: its own source text, with nothing of this module around it. */
const asCopied = <T>(fn: T): T => new Function(`return (${String(fn)});`)() as T;

const workbox = pwaOptions.workbox!;
const routes = workbox.runtimeCaching!;

describe("the service worker's options", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers a page of the app, never an API path or another site", () => {
    expect(isAppPage(match(`${APP}/campaigns/4/warbands/9`, "navigate"))).toBe(true);
    expect(isAppPage(match(`${APP}/`, "navigate"))).toBe(true);

    expect(isAppPage(match(`${APP}/api/campaigns/`, "navigate"))).toBe(false);
    expect(isAppPage(match(`${APP}/campaigns/4`))).toBe(false); // a fetch, not a page
    expect(isAppPage(match("https://mordheim-1.onrender.com/api/campaigns/", "navigate"))).toBe(
      false
    );
  });

  it("keeps only the app's own build files, never the API, Pusher or another site", () => {
    expect(isBuildFile(match(`${APP}/assets/index-DHX6NgHg.js`))).toBe(true);

    expect(isBuildFile(match(`${APP}/api/assets/`))).toBe(false);
    expect(isBuildFile(match("https://mordheim-1.onrender.com/api/campaigns/"))).toBe(false);
    expect(isBuildFile(match("https://sockjs-eu.pusher.com/assets/x.js"))).toBe(false);
    expect(isBuildFile(match("https://fonts.gstatic.com/assets/font.woff2"))).toBe(false);
  });

  it("caches nothing but those two routes, so every other request goes to the network", () => {
    expect(routes.map((route) => route.urlPattern)).toEqual([isAppPage, isBuildFile]);
    expect(routes.every((route) => typeof route.urlPattern === "function")).toBe(true);
  });

  it("loads a page from the network first, giving up after 3 seconds", () => {
    expect(routes[0]).toMatchObject({
      handler: "NetworkFirst",
      options: { networkTimeoutSeconds: 3, plugins: [pagePlugin] },
    });
    // never vite-plugin-pwa's default, which serves the stored copy first
    expect(workbox.navigateFallback).toBeNull();
    // nor the precache's own answer for "/" ahead of the network
    expect(workbox.directoryIndex).toBeNull();
  });

  it("never stores a page, and falls back to this worker's precached index.html", async () => {
    const shell = new Response("<!doctype html>");
    const cacheMatch = vi.fn(async () => shell);
    const open = vi.fn(async () => ({ match: cacheMatch }));
    vi.stubGlobal("caches", { open });
    vi.stubGlobal("registration", { scope: `${APP}/` }); // the worker's self.registration
    const fallBack = asCopied(pagePlugin.cachedResponseWillBeUsed!);

    expect(await asCopied(pagePlugin.cacheWillUpdate!)({ response: shell } as never)).toBeNull();
    expect(await fallBack({ cachedResponse: undefined } as never)).toBe(shell);
    expect(open).toHaveBeenCalledWith(`workbox-precache-v2-${APP}/`);
    expect(cacheMatch).toHaveBeenCalledWith("/index.html", { ignoreSearch: true });
  });

  it("keeps a fetched build file, but not the SPA's index.html a missing one answers with", async () => {
    const keep = asCopied(buildFilePlugin.cacheWillUpdate!);
    const file = new Response("x", { headers: { "content-type": "text/javascript" } });
    const fallback = new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
    const missing = new Response("", { status: 404 });

    expect(await keep({ response: file } as never)).toBe(file);
    expect(await keep({ response: fallback } as never)).toBeNull();
    expect(await keep({ response: missing } as never)).toBeNull();
  });

  it("waits for the player: no skip-waiting, no inline registration, our own manifest", () => {
    expect(pwaOptions).toMatchObject({
      strategies: "generateSW",
      registerType: "prompt",
      injectRegister: false,
      manifest: false,
    });
    expect(workbox).toMatchObject({ skipWaiting: false, clientsClaim: true });
  });

  it("precaches the build, the shell and the fonts' Latin files", () => {
    expect(workbox.globPatterns).toEqual([
      "**/*.{js,css,html,ico,png,svg,webmanifest}",
      "assets/*-latin-*.woff2",
    ]);
  });
});
