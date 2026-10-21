/**
 * Pass 6 characterisation: the requests of a cold start, on the real routes, providers and
 * query client over the fake API server: a reload signed out and signed in (PERF-50), and
 * signing in or up from the landing page (AUTH-TEST-22).
 */
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deferred,
  NAMELESS,
  RAIDER,
  registerAnswer,
  storeSession,
  tokensFor,
} from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const submitButton = () =>
  screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit")!;

/** Every request so far, sorted, once the signed-in shell has settled. */
async function settledCalls(expectedCount: number) {
  await waitFor(() => expect(fakeApi.calls()).toHaveLength(expectedCount));
  // Anything a re-render would add has had its chance by now.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return [...fakeApi.calls()].sort();
}

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  fakeApi.on("GET /notifications/", []);
  fakeApi.on("GET /campaigns/", []);
});

afterEach(() => {
  cleanupApps();
});

describe("a cold start signed out", () => {
  it.each(["/", "/campaigns", "/campaigns/1/settings"])(
    "sends no request at all from %s, and listens on no channel",
    async (path) => {
      renderApp(path);

      await screen.findByRole("heading", { name: "Mordheim Chronicler" });
      expect(fakeApi.calls()).toEqual([]);
      expect(fakeRealtime.channels()).toEqual([]);
    }
  );
});

describe("a cold start signed in", () => {
  it("renders from the cached user at once, with /auth/me read in the background beside the notifications and the campaigns list (PERF-50)", async () => {
    storeSession();
    const me = deferred<typeof RAIDER>();
    fakeApi.on("GET /auth/me/", () => me.promise);
    renderApp("/campaigns");

    await screen.findByRole("heading", { name: "Welcome back, Raider" });
    expect(await settledCalls(3)).toEqual([
      "GET /auth/me/",
      "GET /campaigns/",
      "GET /notifications/",
    ]);
    expect(fakeRealtime.channels()).toEqual(["private-user-1-notifications"]);

    await act(async () => me.resolve(RAIDER));

    expect(await settledCalls(3)).toHaveLength(3);
    expect(fakeRealtime.subscriberCount("private-user-1-notifications")).toBe(1);
  });

  it("without a cached user, sends /auth/me alone until it answers, then the rest once each", async () => {
    storeSession(RAIDER, { cachedUser: false });
    const me = deferred<typeof RAIDER>();
    fakeApi.on("GET /auth/me/", () => me.promise);
    renderApp("/campaigns");

    await waitFor(() => expect(fakeApi.calls()).toEqual(["GET /auth/me/"]));
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");

    await act(async () => me.resolve(RAIDER));

    await screen.findByRole("heading", { name: "Welcome back, Raider" });
    expect(await settledCalls(3)).toEqual([
      "GET /auth/me/",
      "GET /campaigns/",
      "GET /notifications/",
    ]);
    expect(fakeApi.calls()[0]).toBe("GET /auth/me/");
  });

  it("from / reads the same three, on its way to /campaigns", async () => {
    storeSession();
    fakeApi.on("GET /auth/me/", RAIDER);
    const app = renderApp("/");

    await screen.findByRole("heading", { name: "Welcome back, Raider" });
    expect(app.location().pathname).toBe("/campaigns");
    expect(await settledCalls(3)).toEqual([
      "GET /auth/me/",
      "GET /campaigns/",
      "GET /notifications/",
    ]);
  });
});

describe("signing in or up from the landing page", () => {
  it("signs in with one login and no /auth/me, then one notifications read, one list read and one channel (PERF-50, AUTH-TEST-22)", async () => {
    fakeApi.on("POST /auth/login/", { ...tokensFor(RAIDER), user: RAIDER });
    fakeApi.on("GET /auth/me/", RAIDER);
    const user = setupUser();
    renderApp("/");
    await screen.findByRole("heading", { name: "Mordheim Chronicler" });

    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.type(screen.getByLabelText("Password"), "wyrdstone");
    await user.click(submitButton());

    await screen.findByRole("heading", { name: "Welcome back, Raider" });
    expect(await settledCalls(3)).toEqual([
      "GET /campaigns/",
      "GET /notifications/",
      "POST /auth/login/",
    ]);
    expect(fakeRealtime.subscriberCount("private-user-1-notifications")).toBe(1);
  });

  it("signs in with one /auth/me while login's answer has only the tokens (PERF-50)", async () => {
    fakeApi.on("POST /auth/login/", tokensFor(RAIDER));
    fakeApi.on("GET /auth/me/", RAIDER);
    const user = setupUser();
    renderApp("/");
    await screen.findByRole("heading", { name: "Mordheim Chronicler" });

    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.type(screen.getByLabelText("Password"), "wyrdstone");
    await user.click(submitButton());

    await screen.findByRole("heading", { name: "Welcome back, Raider" });
    expect(await settledCalls(4)).toEqual([
      "GET /auth/me/",
      "GET /campaigns/",
      "GET /notifications/",
      "POST /auth/login/",
    ]);
  });

  it("signs up with one register and no /auth/me (PERF-50)", async () => {
    fakeApi.on("POST /auth/register/", registerAnswer(RAIDER));
    fakeApi.on("GET /auth/me/", RAIDER);
    const user = setupUser();
    renderApp("/");
    await screen.findByRole("heading", { name: "Mordheim Chronicler" });

    await user.click(screen.getByRole("button", { name: "Create Account" }));
    await user.type(screen.getByLabelText("Display name"), "Raider");
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.type(screen.getByLabelText("Password"), "wyrdstone");
    await user.click(submitButton());

    await screen.findByRole("heading", { name: "Welcome back, Raider" });
    expect(await settledCalls(3)).toEqual([
      "GET /campaigns/",
      "GET /notifications/",
      "POST /auth/register/",
    ]);
  });
});

describe("a user with no name (signed up before names were required)", () => {
  it("is welcomed without a name, never by their email (SEC-13, AUTH-TWEAK-02)", async () => {
    storeSession({ ...NAMELESS, name: "  " });
    fakeApi.on("GET /auth/me/", { ...NAMELESS, name: "  " });
    renderApp("/campaigns");

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByText(/nameless@example\.com/)).toBeNull();
  });
});
