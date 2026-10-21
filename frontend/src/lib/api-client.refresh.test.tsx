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
import { accessToken, countTokenEvents, deferred, RAIDER } from "@/test/auth-fixtures";
import { fakeFetch, json } from "@/test/fake-fetch";
import { createQueryWrapper } from "@/test/query-test-utils";
import { getRefreshToken, getToken, setRefreshToken, setToken, setTokens } from "@/utils/storage";
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

/** A signed-in page behind ProtectedRoute, with the landing page to fall back to. */
function renderCampaignsScreen() {
  return render(
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
}

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

  it("throws the retry's 401 and clears both tokens: the server has ended the session (BUG-141, AUTH-TEST-21)", async () => {
    const error = await apiRequest("/campaigns/").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: "User not found" });
    expect(fakeFetch.calls()).toEqual([
      "GET /campaigns/",
      "POST /auth/refresh/",
      "GET /campaigns/",
    ]);
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("refreshes no more after that: later requests go out without a token (BUG-141)", async () => {
    await apiRequest("/campaigns/").catch(() => undefined);
    await apiRequest("/campaigns/").catch(() => undefined);
    await apiRequest("/campaigns/").catch(() => undefined);

    expect(fakeFetch.countOf("POST /auth/refresh/")).toBe(1);
    expect(fakeFetch.countOf("GET /campaigns/")).toBe(4);
    const later = fakeFetch.requests().slice(3);
    expect(later.map((request) => request.headers.authorization)).toEqual([undefined, undefined]);
    expect(getToken()).toBeNull();
  });

  it("takes a signed-in screen back to the landing page (BUG-141)", async () => {
    fakeFetch.on("GET /auth/me/", json(200, RAIDER));
    renderCampaignsScreen();
    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();

    await act(async () => {
      await apiRequest("/campaigns/").catch(() => undefined);
    });

    expect(await screen.findByText("Landing page")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it("leaves alone a session that replaced the refreshed one while the retry was out", async () => {
    const other = accessToken(2, "signed-in-meanwhile");
    fakeFetch.on("GET /campaigns/", ({ headers }) => {
      if (headers.authorization === `Bearer ${NEW_ACCESS}`) {
        setTokens({ access: other, refresh: "refresh-2" });
      }
      return userNotFound();
    });

    await apiRequest("/campaigns/").catch(() => undefined);

    expect(getToken()).toBe(other);
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("on a reload, signs out after one refresh and two /auth/me reads: the boot load and its retry (BUG-158)", async () => {
    // A refreshed token for the same account no longer restarts the profile load, even before
    // the profile has loaded, so nothing reads /auth/me a third time or refreshes again.
    fakeFetch.on("GET /auth/me/", userNotFound());
    const { result } = renderHook(() => useAuthContext(), { wrapper: authWrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    await waitFor(() => expect(result.current.token).toBeNull());
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(fakeFetch.calls()).toEqual(["GET /auth/me/", "POST /auth/refresh/", "GET /auth/me/"]);
  });
});

describe("a reload with an expired access token", () => {
  it("refreshes once and reads /auth/me once more, with the new token (BUG-158)", async () => {
    fakeFetch.on("GET /auth/me/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, RAIDER) : tokenNotValid()
    );
    const { result } = renderHook(() => useAuthContext(), { wrapper: authWrapper });

    await waitFor(() => expect(result.current.user).toEqual(RAIDER));
    expect(fakeFetch.calls()).toEqual(["GET /auth/me/", "POST /auth/refresh/", "GET /auth/me/"]);
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

  it("retries a 401 that lands after the shared refresh has finished with its new token, and refreshes no more (BUG-158, AUTH-TEST-19)", async () => {
    const lateAnswer = deferred<Response>();
    fakeFetch.on("GET /a/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, "a") : tokenNotValid()
    );
    fakeFetch.on("GET /b/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, "b") : lateAnswer.promise
    );

    const late = apiRequest("/b/");
    await expect(apiRequest("/a/")).resolves.toBe("a");
    lateAnswer.resolve(tokenNotValid());

    await expect(late).resolves.toBe("b");
    expect(fakeFetch.calls()).toEqual([
      "GET /b/",
      "GET /a/",
      "POST /auth/refresh/",
      "GET /a/",
      "GET /b/",
    ]);
  });

  it("all throw, and the session is cleared, when the retries get a 401 too (BUG-141)", async () => {
    fakeFetch.on("GET /a/", userNotFound());
    fakeFetch.on("GET /b/", userNotFound());

    const results = await Promise.allSettled([apiRequest("/a/"), apiRequest("/b/")]);

    expect(results.map((settled) => settled.status)).toEqual(["rejected", "rejected"]);
    expect(fakeFetch.countOf("POST /auth/refresh/")).toBe(1);
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
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
    renderCampaignsScreen();
    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();

    await act(async () => {
      await apiRequest("/campaigns/").catch(() => undefined);
    });

    expect(await screen.findByText("Landing page")).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });
});

describe("what a refresh may change", () => {
  it("stores a rotated refresh token beside the new access token, in one write (decision 4, AUTH-TWEAK-03)", async () => {
    fakeFetch.on("POST /auth/refresh/", json(200, { access: NEW_ACCESS, refresh: "rotated" }));
    fakeFetch.on("GET /campaigns/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}` ? json(200, []) : tokenNotValid()
    );
    const events = countTokenEvents();

    await expect(apiRequest("/campaigns/")).resolves.toEqual([]);
    events.stop();

    expect(getToken()).toBe(NEW_ACCESS);
    expect(getRefreshToken()).toBe("rotated");
    expect(events.count()).toBe(1);
  });

  it("keeps the stored refresh token when the answer has none (a server that doesn't rotate)", async () => {
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
