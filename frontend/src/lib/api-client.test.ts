import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRefreshToken, getToken, setRefreshToken, setToken } from "../utils/storage";
import {
  ApiError,
  apiRequest,
  REQUEST_ABORTED_MESSAGE,
  REQUEST_TIMEOUT_MESSAGE,
  REQUEST_TIMEOUT_MS,
  SERVER_UNAVAILABLE_MESSAGE,
} from "./api-client";

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

/** A fetch that never answers, but rejects like the browser once its signal aborts. */
function hangingFetch(_input: Parameters<typeof fetch>[0], init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError"))
    );
  });
}

function trackSettlement(promise: Promise<unknown>) {
  const state: { error?: unknown; settled: boolean } = { settled: false };
  promise.then(
    () => (state.settled = true),
    (error: unknown) => {
      state.settled = true;
      state.error = error;
    }
  );
  return state;
}

describe("apiRequest timeout and abort (BUG-59)", () => {
  beforeEach(() => {
    localStorage.clear();
    setToken("access");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives up on a hung request after the default timeout", async () => {
    fetchMock.mockImplementation(hangingFetch);

    const state = trackSettlement(apiRequest("/campaigns/"));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(state.error).toBeInstanceOf(ApiError);
    expect(state.error).toMatchObject({ status: 0, message: REQUEST_TIMEOUT_MESSAGE });
  });

  it("rejects with status 0 when the caller aborts", async () => {
    fetchMock.mockImplementation(hangingFetch);
    const controller = new AbortController();

    const state = trackSettlement(apiRequest("/campaigns/", { signal: controller.signal }));
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(state.error).toBeInstanceOf(ApiError);
    expect(state.error).toMatchObject({ status: 0, message: REQUEST_ABORTED_MESSAGE });
  });

  it("hands fetch a signal and clears its timer once the response arrives", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(apiRequest("/campaigns/")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the session when the refresh call times out", async () => {
    setRefreshToken("refresh-token");
    fetchMock.mockImplementation(async (input, init) =>
      isRefreshCall(input) ? hangingFetch(input, init) : jsonResponse(401, {})
    );

    const state = trackSettlement(apiRequest("/campaigns/"));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    expect(state.error).toMatchObject({ status: 0, message: SERVER_UNAVAILABLE_MESSAGE });
    expect(getToken()).toBe("access");
    expect(getRefreshToken()).toBe("refresh-token");
  });
});

describe("apiRequest abort after a refresh", () => {
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

  it("keeps the caller's signal on the retried request", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async (input, init) => {
      if (isRefreshCall(input)) return jsonResponse(200, { access: "new-access" });
      const auth = new Headers(init?.headers).get("Authorization");
      return auth === "Bearer new-access" ? hangingFetch(input, init) : jsonResponse(401, {});
    });

    const request = apiRequest("/campaigns/", { signal: controller.signal });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    controller.abort();

    await expect(request).rejects.toMatchObject({ status: 0, message: REQUEST_ABORTED_MESSAGE });
  });
});
