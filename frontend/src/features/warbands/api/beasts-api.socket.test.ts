/**
 * The beast writes name this browser's socket (`X-Pusher-Socket-Id`), so the server leaves the
 * writer out of the `warband.changed` it sends (the bestiary rewrite's browser check, item 24):
 * the writer already has the answer in its cache, and the echo would read its sheet again. The
 * companion switch, recruit, back to item, and a purchase (one that recruits announces it).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { purchase } from "@/features/items/api/purchase";
import { createTestQueryClient } from "@/test/query-test-utils";
import { makeItem } from "@/test/warband-fixtures";
import { recruitBeasts, sendBackToItem, switchCompanion } from "./beasts-api";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(async () => ({
    target_type: "stash",
    target_id: null,
    updated_at: null,
    items: null,
    stash_item: null,
    group: null,
    trade: null,
    summary: { gold: 100 },
    warnings: [],
  })),
  socketId: null as string | null,
}));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));
vi.mock("@/lib/realtime/client", () => ({ realtimeSocketId: () => mocks.socketId }));

const headersOfLastCall = () => {
  const calls = mocks.apiRequest.mock.calls as unknown as [string, { headers?: unknown }?][];
  return calls[calls.length - 1][1]?.headers;
};

const wardogs = makeItem({ id: 142, name: "Wardogs", type: "Animal" });
const meta = {
  isBuying: true,
  quantity: 1,
  unitPrice: 25,
  totalPrice: 25,
  reason: "",
  baseCost: 25,
};

const WRITES: [string, () => Promise<unknown>][] = [
  ["switch a companion", () => switchCompanion(9, "hero", 11, 5, true)],
  [
    "recruit creatures",
    () =>
      recruitBeasts(9, {
        source: { type: "stash", item_id: 142 },
        quantity: 1,
        target: { new: {} },
      }),
  ],
  ["send members back to their item", () => sendBackToItem(9, 25, { count: 1 })],
  [
    "buy and recruit",
    () =>
      purchase(
        { warbandId: 9, target: { kind: "stash" }, item: wardogs, meta, recruit: { new: {} } },
        createTestQueryClient()
      ),
  ],
];

describe("beast writes name this browser's socket", () => {
  beforeEach(() => {
    mocks.apiRequest.mockClear();
    mocks.socketId = "123.456";
  });

  it.each(WRITES)("sends X-Pusher-Socket-Id to %s", async (_name, write) => {
    await write();

    expect(headersOfLastCall()).toEqual({ "X-Pusher-Socket-Id": "123.456" });
  });

  it("sends no header before the realtime connection has a socket", async () => {
    mocks.socketId = null;

    await switchCompanion(9, "hero", 11, 5, false);

    expect(headersOfLastCall()).toBeUndefined();
  });
});
