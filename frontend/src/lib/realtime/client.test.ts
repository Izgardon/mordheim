import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "@/lib/session";

const { FakePusher, refreshSession } = vi.hoisted(() => {
  class FakeChannel {
    callbacks: ((event: string, data: unknown) => void)[] = [];
    constructor(public name: string) {}
    bind_global(callback: (event: string, data: unknown) => void) {
      this.callbacks.push(callback);
    }
    emit(event: string, data?: unknown) {
      this.callbacks.forEach((callback) => callback(event, data));
    }
  }

  class FakePusher {
    static instances: FakePusher[] = [];
    channels = new Map<string, FakeChannel>();
    connectionCallbacks = new Map<string, (state: { previous: string; current: string }) => void>();
    connection = {
      bind: (event: string, callback: (state: { previous: string; current: string }) => void) => {
        this.connectionCallbacks.set(event, callback);
      },
    };
    subscribe = vi.fn((name: string) => {
      const channel = this.channels.get(name) ?? new FakeChannel(name);
      this.channels.set(name, channel);
      return channel;
    });
    unsubscribe = vi.fn((name: string) => {
      this.channels.delete(name);
    });
    disconnect = vi.fn();

    constructor(
      public key: string,
      public options: {
        channelAuthorization: { headersProvider: () => Record<string, string> };
      }
    ) {
      FakePusher.instances.push(this);
    }

    setState(previous: string, current: string) {
      this.connectionCallbacks.get("state_change")?.({ previous, current });
    }
  }

  return { FakePusher, refreshSession: vi.fn() };
});

vi.mock("pusher-js", () => ({ default: FakePusher }));
vi.mock("@/lib/api-client", () => ({ refreshSession }));
vi.mock("@/config/env", () => ({
  PUSHER_KEY: "test-key",
  PUSHER_CLUSTER: "eu",
  PUSHER_AUTH_ENDPOINT: "/api/realtime/pusher/auth/",
  PUSHER_HOST: "",
  PUSHER_PORT: 6001,
  PUSHER_FORCE_TLS: true,
}));

// The client keeps module-level state (one connection per app), so each test gets a fresh copy.
const loadClient = async () => {
  vi.resetModules();
  return import("./client");
};

const connected = async () => {
  await vi.waitFor(() => expect(FakePusher.instances.length).toBeGreaterThan(0));
  return FakePusher.instances[FakePusher.instances.length - 1];
};

describe("realtime client", () => {
  beforeEach(() => {
    FakePusher.instances = [];
    refreshSession.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shares one connection and one channel subscription between subscribers", async () => {
    const { subscribe } = await loadClient();
    const first = vi.fn();
    const second = vi.fn();

    const unsubscribeFirst = subscribe("private-campaign-7-chat", "chat.message", first);
    const unsubscribeSecond = subscribe("private-campaign-7-chat", "chat.message", second);
    const pusher = await connected();

    expect(FakePusher.instances).toHaveLength(1);
    expect(pusher.subscribe).toHaveBeenCalledTimes(1);
    pusher.channels.get("private-campaign-7-chat")?.emit("chat.message", { id: 1 });
    pusher.channels.get("private-campaign-7-chat")?.emit("other.event", { id: 2 });
    expect(first).toHaveBeenCalledWith({ id: 1 });
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    expect(pusher.unsubscribe).not.toHaveBeenCalled();
    unsubscribeSecond();
    expect(pusher.unsubscribe).toHaveBeenCalledWith("private-campaign-7-chat");
  });

  it("authorises channels with the token current at request time (BUG-57)", async () => {
    session.setTokens({ access: "token-at-connect" });
    const { subscribe } = await loadClient();
    subscribe("private-user-1-notifications", "notification", vi.fn());
    const pusher = await connected();

    session.setTokens({ access: "refreshed-token" });

    expect(pusher.options.channelAuthorization.headersProvider()).toEqual({
      Authorization: "Bearer refreshed-token",
    });
  });

  it("refreshes an expired token and resubscribes when channel auth returns 401", async () => {
    refreshSession.mockResolvedValue(true);
    const { subscribe } = await loadClient();
    const handler = vi.fn();
    subscribe("private-battle-3", "battle.event", handler);
    const pusher = await connected();

    pusher.channels.get("private-battle-3")?.emit("pusher:subscription_error", { status: 401 });

    await vi.waitFor(() => expect(pusher.subscribe).toHaveBeenCalledTimes(2));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(pusher.unsubscribe).toHaveBeenCalledWith("private-battle-3");
    pusher.channels.get("private-battle-3")?.emit("battle.event", { type: "x" });
    expect(handler).toHaveBeenCalledWith({ type: "x" });
  });

  it("does not refresh for other auth failures", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { subscribe } = await loadClient();
    subscribe("private-battle-3", "battle.event", vi.fn());
    const pusher = await connected();

    pusher.channels.get("private-battle-3")?.emit("pusher:subscription_error", { status: 403 });

    expect(refreshSession).not.toHaveBeenCalled();
    expect(pusher.subscribe).toHaveBeenCalledTimes(1);
  });

  it("reports a reconnect after a drop, but not the first connect", async () => {
    const { onConnectionRestored, subscribe } = await loadClient();
    const restored = vi.fn();
    onConnectionRestored(restored);
    subscribe("private-user-1-notifications", "notification", vi.fn());
    const pusher = await connected();

    pusher.setState("connecting", "connected");
    expect(restored).not.toHaveBeenCalled();

    pusher.setState("connected", "unavailable");
    pusher.setState("unavailable", "connected");
    expect(restored).toHaveBeenCalledTimes(1);
  });

  it("disconnects on sign-out and opens a fresh connection for the next subscriber", async () => {
    const { disconnectRealtime, subscribe } = await loadClient();
    const unsubscribe = subscribe("private-user-1-notifications", "notification", vi.fn());
    const first = await connected();

    disconnectRealtime();
    unsubscribe();
    expect(first.disconnect).toHaveBeenCalledTimes(1);

    subscribe("private-user-2-notifications", "notification", vi.fn());
    await vi.waitFor(() => expect(FakePusher.instances).toHaveLength(2));
    expect(FakePusher.instances[1].subscribe).toHaveBeenCalledWith("private-user-2-notifications");
    expect(FakePusher.instances[1].subscribe).not.toHaveBeenCalledWith(
      "private-user-1-notifications"
    );
  });

  it("does not load pusher-js until something subscribes", async () => {
    await loadClient();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(FakePusher.instances).toHaveLength(0);
  });

  it("gives this browser's socket id once connected, for trade writes to name (ECON-PERF-02)", async () => {
    const { realtimeSocketId, subscribe } = await loadClient();
    expect(realtimeSocketId()).toBeNull();

    subscribe("private-trade-t-1", "trade.offer_updated", vi.fn());
    const pusher = await connected();
    expect(realtimeSocketId()).toBeNull();
    (pusher.connection as { socket_id?: string }).socket_id = "123.456";

    expect(realtimeSocketId()).toBe("123.456");
  });
});
