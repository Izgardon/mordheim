/**
 * The double buy (docs/plans/offline.md): a Buy all whose answer was lost on weak signal may have
 * bought on the server, so tapping it again must not buy twice. Each basket line carries its own
 * request key, sent as `Idempotency-Key` and the same on a retry; an edited line is a new attempt.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "@/lib/session";
import { accessToken, RAIDER } from "@/test/auth-fixtures";
import { fakeFetch, json } from "@/test/fake-fetch";
import { createQueryWrapper } from "@/test/query-test-utils";
import { makeItem } from "@/test/warband-fixtures";

import { useStoreBasket, type Recipient } from "./useStoreBasket";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

// a warband per test: baskets are kept per warband for the whole visit
let warband = 40;
const purchases = () => `POST /warbands/${warband}/purchases/`;
const STASH: Recipient = { key: "stash", label: "Stash", target: { kind: "stash" }, count: 1 };
const ANSWER = {
  target_type: "stash",
  target_id: null,
  updated_at: null,
  items: null,
  stash_item: null,
  trade: null,
  summary: {},
  warnings: [],
};

const line = (name: string, price = 10) => ({
  item: makeItem({ id: name.length, name }),
  availabilityId: null,
  baseCost: price,
  recipient: STASH,
  price,
  free: false,
  reason: "",
});

const keysSent = () =>
  fakeFetch
    .requests()
    .filter((request) => `${request.method} ${request.path}` === purchases())
    .map((request) => request.headers["idempotency-key"]);

function renderBasket() {
  return renderHook(() => useStoreBasket(warband), { wrapper: createQueryWrapper() });
}

beforeEach(() => {
  warband += 1;
  sessionStorage.clear();
  session.setTokens({ access: accessToken(RAIDER.id), refresh: "refresh-1" });
  fakeFetch.install();
});

afterEach(() => {
  fakeFetch.uninstall();
});

describe("useStoreBasket request keys", () => {
  it("sends a line's purchase again with the same key after a lost answer", async () => {
    fakeFetch.on(purchases(), json(503, { detail: "Unavailable" }));
    const { result } = renderBasket();
    act(() => result.current.add(line("Sword")));

    await act(async () => {
      expect(await result.current.buyAll()).toBe(false);
    });
    fakeFetch.on(purchases(), json(201, ANSWER));
    await act(async () => {
      expect(await result.current.buyAll()).toBe(true);
    });

    const [first, retry] = keysSent();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(retry).toBe(first);
  });

  it("gives each line its own key, and an edited line a new one", async () => {
    fakeFetch.on(purchases(), json(503, { detail: "Unavailable" }));
    const { result } = renderBasket();
    act(() => {
      result.current.add(line("Sword"));
      result.current.add(line("Axe"));
    });
    const [sword, axe] = result.current.lines;
    expect(sword.requestKey).not.toBe(axe.requestKey);

    await act(async () => {
      await result.current.buyAll();
    });
    act(() => result.current.setPrice(sword.id, 12));
    await act(async () => {
      await result.current.buyAll();
    });

    const [first, afterEdit] = keysSent();
    expect(first).toBe(sword.requestKey);
    expect(afterEdit).not.toBe(first);
  });
});
