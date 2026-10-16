import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRefreshToken, getToken, setRefreshToken, setToken } from "../utils/storage";
import { ApiError, apiRequest, SERVER_UNAVAILABLE_MESSAGE } from "./api-client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn<typeof fetch>();

function isRefreshCall(input: Parameters<typeof fetch>[0]) {
  return String(input).endsWith("/auth/refresh/");
}

describe("apiRequest token refresh", () => {
  beforeEach(() => {
    localStorage.clear();
    setToken("expired-access");
    setRefreshToken("refresh-token");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries with the new access token after a successful refresh", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (isRefreshCall(input)) return jsonResponse(200, { access: "new-access" });
      const auth = new Headers(init?.headers).get("Authorization");
      return auth === "Bearer new-access"
        ? jsonResponse(200, { ok: true })
        : jsonResponse(401, { detail: "expired" });
    });

    await expect(apiRequest("/campaigns/")).resolves.toEqual({ ok: true });
    expect(getToken()).toBe("new-access");
  });

  it("clears the session when the refresh token is rejected", async () => {
    fetchMock.mockImplementation(async (input) =>
      isRefreshCall(input)
        ? jsonResponse(401, { detail: "Token is invalid or expired" })
        : jsonResponse(401, {})
    );

    await expect(apiRequest("/campaigns/")).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it.each([
    ["server error", () => jsonResponse(503, { detail: "unavailable" }), 503],
    ["rate limit", () => jsonResponse(429, { detail: "throttled" }), 429],
    [
      "network failure",
      () => {
        throw new TypeError("Failed to fetch");
      },
      0,
    ],
  ])(
    "keeps the session when refresh fails with a %s",
    async (_label, refreshResult, expectedStatus) => {
      fetchMock.mockImplementation(async (input) =>
        isRefreshCall(input) ? refreshResult() : jsonResponse(401, {})
      );

      const error = await apiRequest("/campaigns/").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: expectedStatus, message: SERVER_UNAVAILABLE_MESSAGE });
      expect(getToken()).toBe("expired-access");
      expect(getRefreshToken()).toBe("refresh-token");
    }
  );

  it("shares one refresh between concurrent requests", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (isRefreshCall(input)) return jsonResponse(200, { access: "new-access" });
      const auth = new Headers(init?.headers).get("Authorization");
      return auth === "Bearer new-access" ? jsonResponse(200, {}) : jsonResponse(401, {});
    });

    await Promise.all([apiRequest("/a/"), apiRequest("/b/"), apiRequest("/c/")]);

    expect(fetchMock.mock.calls.filter(([input]) => isRefreshCall(input))).toHaveLength(1);
  });
});
