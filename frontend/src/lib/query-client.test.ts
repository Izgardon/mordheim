import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-client";
import { createQueryClient, shouldRetryQuery } from "./query-client";
import { queryKeys } from "./query-keys";

describe("shouldRetryQuery", () => {
  it.each([
    ["a network failure", new TypeError("Failed to fetch")],
    ["a timeout or abort (status 0)", new ApiError("timed out", 0, null)],
    ["a server error", new ApiError("boom", 503, null)],
  ])("retries once after %s", (_label, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
  });

  it.each([400, 401, 403, 404, 429])("never retries a %s response", (status) => {
    expect(shouldRetryQuery(0, new ApiError("nope", status, null))).toBe(false);
  });

  it("does not retry programming errors", () => {
    expect(shouldRetryQuery(0, new Error("bug"))).toBe(false);
  });
});

describe("createQueryClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  it("never retries mutations", () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("starts offline when the app opens with no signal, so its reads wait rather than fail", () => {
    // the service worker opens the app cold in airplane mode, and no `offline` event ever fires
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    createQueryClient();
    expect(onlineManager.isOnline()).toBe(false);

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    createQueryClient();
    expect(onlineManager.isOnline()).toBe(true);
  });
});

describe("queryKeys", () => {
  it("nests every campaign-scoped key under the campaign prefix", () => {
    const prefix = queryKeys.campaign.all(7);
    const keys = [
      queryKeys.campaign.detail(7),
      queryKeys.campaign.catalogue(7, "items"),
      queryKeys.campaign.openBattles(7),
    ];
    for (const key of keys) {
      expect(key.slice(0, prefix.length)).toEqual([...prefix]);
    }
  });
});
