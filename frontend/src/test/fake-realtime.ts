/**
 * A fake realtime client behind `@/lib/realtime/client`, for tests that drive a screen with
 * socket events and reconnects. The real `useChannel` / `useBattleEvents` hooks run on top of it.
 * Mock the client in the test file with:
 *
 *   vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
 *
 * Then `fakeRealtime.emit("private-battle-5", "battle.event", data)` (inside `act`) delivers an
 * event to every subscriber, and `fakeRealtime.restoreConnection()` runs the reconnect listeners.
 */

type Handler = (data: unknown) => void;

type Subscription = { channel: string; event: string; handler: Handler };

const subscriptions = new Set<Subscription>();
const restoredListeners = new Set<() => void>();

export const fakeClient = {
  isRealtimeEnabled: () => true,
  realtimeSocketId: (): string | null => null,
  disconnectRealtime: () => undefined,
  subscribe(channel: string, event: string, handler: Handler) {
    const subscription = { channel, event, handler };
    subscriptions.add(subscription);
    return () => {
      subscriptions.delete(subscription);
    };
  },
  onConnectionRestored(listener: () => void) {
    restoredListeners.add(listener);
    return () => {
      restoredListeners.delete(listener);
    };
  },
};

export const fakeRealtime = {
  /** Delivers `data` as `event` on `channel` to every current subscriber. */
  emit(channel: string, event: string, data: unknown) {
    for (const subscription of [...subscriptions]) {
      if (subscription.channel === channel && subscription.event === event) {
        subscription.handler(data);
      }
    }
  },

  /** Runs every "connection came back after a drop" listener. */
  restoreConnection() {
    [...restoredListeners].forEach((listener) => listener());
  },

  /** How many subscribers listen to `channel`. */
  subscriberCount: (channel: string) =>
    [...subscriptions].filter((subscription) => subscription.channel === channel).length,

  /** Every channel something listens to, sorted. */
  channels: () =>
    [...new Set([...subscriptions].map((subscription) => subscription.channel))].sort(),

  reset() {
    subscriptions.clear();
    restoredListeners.clear();
  },
};
