import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptTradeRequest,
  closeTradeRequest,
  declineTradeRequest,
  getTradeRequest,
  lockTradeOffer,
  unlockTradeOffer,
  updateTradeOffer,
} from "./campaigns-api";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(async () => ({})),
  socketId: null as string | null,
}));

vi.mock("../../../lib/api-client", () => ({ apiRequest: mocks.apiRequest }));
vi.mock("@/lib/realtime/client", () => ({ realtimeSocketId: () => mocks.socketId }));

const headersOfLastCall = () => {
  const calls = mocks.apiRequest.mock.calls as unknown as [string, { headers?: unknown }][];
  return calls[calls.length - 1][1].headers;
};

describe("campaigns-api: trade writes name this browser's socket (ECON-PERF-02)", () => {
  beforeEach(() => {
    mocks.apiRequest.mockClear();
    mocks.socketId = "123.456";
  });

  it("sends X-Pusher-Socket-Id on every trade write, so the server skips echoing it", async () => {
    const writes = [
      () => acceptTradeRequest(7, "t-1"),
      () => updateTradeOffer(7, "t-1", { gold: 5 }),
      () => lockTradeOffer(7, "t-1", 3),
      () => unlockTradeOffer(7, "t-1"),
      () => declineTradeRequest(7, "t-1"),
      () => closeTradeRequest(7, "t-1"),
    ];
    for (const write of writes) {
      await write();
      expect(headersOfLastCall()).toEqual({ "X-Pusher-Socket-Id": "123.456" });
    }
  });

  it("sends no header before the realtime connection has a socket, and none on reads", async () => {
    mocks.socketId = null;
    await lockTradeOffer(7, "t-1", 3);
    expect(headersOfLastCall()).toBeUndefined();

    mocks.socketId = "123.456";
    await getTradeRequest(7, "t-1");
    expect(headersOfLastCall()).toBeUndefined();
  });
});
