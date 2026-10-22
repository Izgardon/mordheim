/**
 * The server's `session_ended` refusal (pass 6 PR A) through the real api-client, on the app's
 * own routes: a token from before the session key, a session ended on another device, and one
 * ended mid-visit all land on the sign-in card saying why, after one refused refresh.
 */
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api-client";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { fakeFetch, json } from "@/test/fake-fetch";
import { fakeRealtime } from "@/test/fake-realtime";

vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const SESSION_ENDED = "Your session ended. Please sign in again.";

/** The server's answer to a token whose session key is missing (pre-deploy) or has changed. */
const sessionEnded = () =>
  json(
    401,
    { detail: "Your session has ended. Please sign in again.", code: "session_ended" },
    { "WWW-Authenticate": 'Bearer realm="api"' }
  );

const landing = () => screen.findByRole("heading", { name: "Mordheim Chronicler" });

beforeEach(() => {
  localStorage.clear();
  fakeRealtime.reset();
  fakeFetch.install();
  // The refresh runs the same session check, so it is refused too.
  fakeFetch.on("POST /auth/refresh/", sessionEnded());
});

afterEach(() => {
  cleanupApps();
  fakeFetch.uninstall();
});

describe("a session the server has ended (session_ended)", () => {
  it("from before the deploy (no session key, no cached user) lands on sign-in saying so, after one refresh (AUTH-TWEAK-04)", async () => {
    storeSession(RAIDER, { cachedUser: false });
    fakeFetch.on("GET /auth/me/", sessionEnded());
    const app = renderApp("/campaigns");

    await landing();
    expect(await screen.findByText(SESSION_ENDED)).toHaveAttribute("role", "status");
    expect(app.location()).toMatchObject({
      pathname: "/",
      state: { from: { pathname: "/campaigns" }, reason: "session-ended" },
    });
    expect(fakeFetch.calls()).toEqual(["GET /auth/me/", "POST /auth/refresh/"]);
    expect(localStorage.length).toBe(0);
  });

  it("on another device (sign-out-others, a password change or reset) lands on sign-in from the cached user's first reads, with one refresh (AUTH-NEW-04)", async () => {
    storeSession();
    fakeFetch.on("GET /auth/me/", sessionEnded());
    fakeFetch.on("GET /campaigns/", sessionEnded());
    fakeFetch.on("GET /notifications/", sessionEnded());
    const app = renderApp("/campaigns");

    await landing();
    expect(await screen.findByText(SESSION_ENDED)).toBeInTheDocument();
    expect(app.location().state).toMatchObject({ reason: "session-ended" });
    expect(fakeFetch.countOf("POST /auth/refresh/")).toBe(1);
    expect(localStorage.length).toBe(0);
  });

  it("mid-visit lands on sign-in saying so, and the cache is emptied", async () => {
    storeSession();
    fakeFetch.on("GET /auth/me/", json(200, RAIDER));
    fakeFetch.on("GET /campaigns/", json(200, []));
    fakeFetch.on("GET /notifications/", json(200, []));
    const app = renderApp("/campaigns");
    await screen.findByRole("heading", { name: "Welcome back, Raider" });

    // Another device signs out everywhere else: this one's next request meets session_ended.
    fakeFetch.on("GET /campaigns/", sessionEnded());
    await act(async () => {
      await apiRequest("/campaigns/").catch(() => undefined);
    });

    await landing();
    expect(screen.getByText(SESSION_ENDED)).toBeInTheDocument();
    expect(app.location().state).toMatchObject({
      from: { pathname: "/campaigns" },
      reason: "session-ended",
    });
    expect(app.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.length).toBe(0);
  });
});
