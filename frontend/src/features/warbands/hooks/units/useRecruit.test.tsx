/**
 * The double buy (docs/plans/offline.md): a recruit Save whose answer was lost on weak signal may
 * have recruited on the server, so Save tapped again sends the same `Idempotency-Key` and the
 * server answers it again; the next recruit after one that saved is a new attempt.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "@/lib/session";
import { accessToken, RAIDER } from "@/test/auth-fixtures";
import { fakeFetch, json } from "@/test/fake-fetch";
import { createQueryWrapper } from "@/test/query-test-utils";

import { blankRecruit, useRecruit } from "./useRecruit";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

const SAVE = "POST /warbands/9/heroes/batch/";
const ANA = { ...blankRecruit(), name: "Ana", type: "Champion", cost: "35" };

const keysSent = () =>
  fakeFetch
    .requests()
    .filter((request) => `${request.method} ${request.path}` === SAVE)
    .map((request) => request.headers["idempotency-key"]);

beforeEach(() => {
  session.setTokens({ access: accessToken(RAIDER.id), refresh: "refresh-1" });
  fakeFetch.install();
});

afterEach(() => {
  fakeFetch.uninstall();
});

describe("useRecruit request keys", () => {
  it("sends the same Save again with its key, and a new recruit with a new one", async () => {
    const { result } = renderHook(() => useRecruit("hero", 9, []), {
      wrapper: createQueryWrapper(),
    });
    fakeFetch.on(SAVE, json(503, { detail: "Unavailable" }));
    await act(async () => {
      expect(await result.current.recruit(ANA)).toBeNull();
    });
    fakeFetch.on(SAVE, json(200, { units: [{ id: 12 }], summary: {}, warnings: [] }));
    await act(async () => {
      expect(await result.current.recruit(ANA)).toBe("hero-12");
    });
    await act(async () => {
      await result.current.recruit(ANA);
    });

    const [first, retry, next] = keysSent();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(retry).toBe(first);
    expect(next).not.toBe(first);
  });
});
