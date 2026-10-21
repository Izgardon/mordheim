/**
 * Pass 6 characterisation: what the real `apiRequest` does around a token refresh, through a fake
 * `fetch`. A retry that still gets a 401 (BUG-141), 401s arriving together, a refused refresh
 * signing the user out, and what a refresh answer is allowed to change.
 */
import type { PropsWithChildren } from "react";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider, useAuthContext } from "@/features/auth/stores/auth-store";
import { accessToken, countTokenEvents, RAIDER } from "@/test/auth-fixtures";
import { fakeFetch, json } from "@/test/fake-fetch";
import { createQueryWrapper } from "@/test/query-test-utils";
import { getRefreshToken, getToken, setRefreshToken, setToken } from "@/utils/storage";
import { ApiError, apiRequest } from "./api-client";

vi.mock("@/lib/realtime/client", () => ({ disconnectRealtime: vi.fn() }));

const OLD_ACCESS = accessToken(RAIDER.id, "old");
const NEW_ACCESS = accessToken(RAIDER.id, "new");

/** SimpleJWT's 401 for a token whose user is gone (or inactive): refresh still mints one. */
const userNotFound = () => json(401, { detail: "User not found", code: "user_not_found" });
const QueryWrapper = createQueryWrapper();
const authWrapper = ({ children }: PropsWithChildren) => (
  <QueryWrapper>
    <AuthProvider>{children}</AuthProvider>
  </QueryWrapper>
);

const tokenNotValid = () =>
  json(401, { detail: "Given token not valid for any token type", code: "token_not_valid" });

beforeEach(() => {
  localStorage.clear();
  setToken(OLD_ACCESS);
  setRefreshToken("refresh-1");
  fakeFetch.install();
  fakeFetch.on("POST /auth/refresh/", json(200, { access: NEW_ACCESS }));
});

afterEach(() => {
  fakeFetch.uninstall();
});

describe("a retry that still gets a 401 after a successful refresh", () => {
  beforeEach(() => {
    fakeFetch.on("GET /campaigns/", userNotFound());
  });

  it("throws the retry's 401 but keeps both tokens, the refreshed access included (BUG-141, AUTH-TEST-21, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (BUG-141, pinned; flips in PR A)
    const error = await apiRequest("/campaigns/").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: "User not found" });
    expect(fakeFetch.calls()).toEqual([
      "GET /campaigns/",
      "POST /auth/refresh/",
      "GET /campaigns/",
    ]);
    expect(getToken()).toBe(NEW_ACCESS);
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("repeats the refresh and the retry on every later request (BUG-141, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (BUG-141, pinned; flips in PR A)
    await apiRequest("/campaigns/").catch(() => undefined);
    await apiRequest("/campaigns/").catch(() => undefined);
    await apiRequest("/campaigns/").catch(() => undefined);

    expect(fakeFetch.countOf("POST /auth/refresh/")).toBe(3);
    expect(fakeFetch.countOf("GET /campaigns/")).toBe(6);
    expect(getToken()).toBe(NEW_ACCESS);
  });

  it("is ended only by a reload: the boot /auth/me meets the same 401, after two refreshes and five reads, and the session is cleared (BUG-141, PERF-50, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (PERF-50, pinned; flips in PR A). With no user loaded yet,
    // each refreshed token restarts the profile load, so the boot reads /auth/me five times.
    fakeFetch.on("GET /auth/me/", userNotFound());
    const { result } = renderHook(() => useAuthContext(), { wrapper: authWrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.token).toBeNull();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(fakeFetch.countOf("POST /auth/refresh/")).toBe(2);
    expect(fakeFetch.countOf("GET /auth/me/")).toBe(5);
  });
});

describe("a reload with an expired access token", () => {
  it("refreshes once, then reads /auth/me twice with the new token: the retry and a second load (PERF-50, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (PERF-50, pinned; flips in PR A)
    fakeFetch.on("GET /auth/me/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, RAIDER) : tokenNotValid()
    );
    const { result } = renderHook(() => useAuthContext(), { wrapper: authWrapper });

    await waitFor(() => expect(result.current.user).toEqual(RAIDER));
    expect(fakeFetch.calls()).toEqual([
      "GET /auth/me/",
      "POST /auth/refresh/",
      "GET /auth/me/",
      "GET /auth/me/",
    ]);
    expect(result.current.token).toBe(NEW_ACCESS);
  });
});

describe("401s that arrive together", () => {
  it("share one refresh, and each request is retried once with the new token (AUTH-TEST-19)", async () => {
    fakeFetch.on("GET /a/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, "a") : tokenNotValid()
    );
    fakeFetch.on("GET /b/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, "b") : tokenNotValid()
    );
    fakeFetch.on("GET /c/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, "c") : tokenNotValid()
    );

    const answers = await Promise.all([apiRequest("/a/"), apiRequest("/b/"), apiRequest("/c/")]);

    expect(answers).toEqual(["a", "b", "c"]);
    expect(fakeFetch.countOf("POST /auth/refresh/")).toBe(1);
    expect(fakeFetch.calls()).toHaveLength(7);
    expect(fakeFetch.countOf("GET /a/")).toBe(2);
    expect(fakeFetch.countOf("GET /b/")).toBe(2);
    expect(fakeFetch.countOf("GET /c/")).toBe(2);
  });

  it("all throw, with the tokens kept, when the retries get a 401 too (BUG-141, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (BUG-141, pinned; flips in PR A)
    fakeFetch.on("GET /a/", userNotFound());
    fakeFetch.on("GET /b/", userNotFound());

    const results = await Promise.allSettled([apiRequest("/a/"), apiRequest("/b/")]);

    expect(results.map((settled) => settled.status)).toEqual(["rejected", "rejected"]);
    expect(fakeFetch.countOf("POST /auth/refresh/")).toBe(1);
    expect(getToken()).toBe(NEW_ACCESS);
    expect(getRefreshToken()).toBe("refresh-1");
  });
});

describe("a refused refresh", () => {
  it.each([400, 401])(
    "answering %i clears both tokens, tells the app, and throws the request's own 401 as sent (AUTH-TEST-20)",
    async (status) => {
      fakeFetch.on("GET /campaigns/", tokenNotValid());
      fakeFetch.on("POST /auth/refresh/", json(status, { detail: "Token is invalid or expired" }));
      const events = countTokenEvents();

      const error = await apiRequest("/campaigns/").catch((caught: unknown) => caught);
      events.stop();

      expect(error).toMatchObject({
        status: 401,
        message: "Given token not valid for any token type",
      });
      expect(getToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(events.count()).toBe(1);
      expect(fakeFetch.calls()).toEqual(["GET /campaigns/", "POST /auth/refresh/"]);
    }
  );

  it("takes a signed-in screen back to the landing page", async () => {
    fakeFetch.on("GET /auth/me/", json(200, RAIDER));
    fakeFetch.on("GET /campaigns/", tokenNotValid());
    fakeFetch.on("POST /auth/refresh/", json(401, { detail: "Token is invalid or expired" }));
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/campaigns"]}>
          <Routes>
            <Route path="/" element={<p>Landing page</p>} />
            <Route
              path="/campaigns"
              element={
                <ProtectedRoute>
                  <p>Campaigns page</p>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
      { wrapper: createQueryWrapper() }
    );
    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();

    await act(async () => {
      await apiRequest("/campaigns/").catch(() => undefined);
    });

    expect(await screen.findByText("Landing page")).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });
});

describe("what a refresh may change", () => {
  it("stores only the new access token; a rotated refresh token in the answer is dropped (decision 4, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (decision 4, AUTH-TWEAK-03, pinned; flips in PR A)
    fakeFetch.on("POST /auth/refresh/", json(200, { access: NEW_ACCESS, refresh: "rotated" }));
    fakeFetch.on("GET /campaigns/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, []) : tokenNotValid()
    );

    await expect(apiRequest("/campaigns/")).resolves.toEqual([]);

    expect(getToken()).toBe(NEW_ACCESS);
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("never refreshes for a request sent with token: null (login, register, reset)", async () => {
    fakeFetch.on("POST /auth/login/", json(401, { detail: "No active account" }));

    const error = await apiRequest("/auth/login/", {
      method: "POST",
      body: { email: RAIDER.email, password: "wrong" },
      token: null,
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 401, message: "No active account" });
    expect(fakeFetch.calls()).toEqual(["POST /auth/login/"]);
    expect(getToken()).toBe(OLD_ACCESS);
  });
});
