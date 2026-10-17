import type Pusher from "pusher-js";
import type { Channel } from "pusher-js";

import {
  PUSHER_AUTH_ENDPOINT,
  PUSHER_CLUSTER,
  PUSHER_FORCE_TLS,
  PUSHER_HOST,
  PUSHER_KEY,
  PUSHER_PORT,
} from "@/config/env";
import { refreshSession } from "@/lib/api-client";
import { getToken } from "@/utils/storage";

/**
 * The app's one realtime connection (PERF-18, IMP-14). pusher-js is downloaded the first time
 * something subscribes (only signed-in screens do), every channel shares one WebSocket, and a
 * channel stays subscribed while at least one subscriber holds it.
 */

type Handler = (data: unknown) => void;

type ChannelEntry = {
  refs: number;
  handlers: Map<string, Set<Handler>>;
  /** One token refresh per failed authorisation, reset once the channel subscribes. */
  authRetried: boolean;
};

const channels = new Map<string, ChannelEntry>();
const restoredListeners = new Set<() => void>();
const boundChannels = new WeakSet<Channel>();

let client: Pusher | null = null;
let clientPromise: Promise<Pusher | null> | null = null;
let clientGeneration = 0;
let hasConnected = false;
let warnedDisabled = false;

export const isRealtimeEnabled = () => Boolean(PUSHER_KEY && PUSHER_CLUSTER);

/** Channel auth reads the token at request time, so a refreshed token is always used (BUG-57). */
const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function dispatch(channelName: string, event: string, data: unknown) {
  const entry = channels.get(channelName);
  if (!entry) {
    return;
  }
  if (event === "pusher:subscription_succeeded") {
    entry.authRetried = false;
    return;
  }
  if (event === "pusher:subscription_error") {
    void recoverFromAuthError(channelName, data);
    return;
  }
  entry.handlers.get(event)?.forEach((handler) => handler(data));
}

function attachChannel(pusher: Pusher, channelName: string) {
  const channel = pusher.subscribe(channelName);
  if (!boundChannels.has(channel)) {
    boundChannels.add(channel);
    channel.bind_global((event: string, data: unknown) => dispatch(channelName, event, data));
  }
}

/** An expired access token makes channel auth fail with 401: refresh it and subscribe again. */
async function recoverFromAuthError(channelName: string, error: unknown) {
  const entry = channels.get(channelName);
  const status = (error as { status?: unknown } | null)?.status;
  if (!entry || status !== 401 || entry.authRetried) {
    console.warn(`Realtime subscription to ${channelName} failed`, error);
    return;
  }
  entry.authRetried = true;
  const refreshed = await refreshSession().catch(() => false);
  if (refreshed && client && channels.get(channelName) === entry) {
    client.unsubscribe(channelName);
    attachChannel(client, channelName);
  }
}

function handleStateChange({ previous, current }: { previous: string; current: string }) {
  if (current !== "connected") {
    return;
  }
  // The first connect is not a reconnect; later ones mean events may have been missed.
  if (hasConnected && previous !== "connected") {
    restoredListeners.forEach((listener) => listener());
  }
  hasConnected = true;
}

function loadClient() {
  if (!isRealtimeEnabled()) {
    if (!warnedDisabled && typeof window !== "undefined") {
      warnedDisabled = true;
      console.warn("Pusher is not configured. Realtime features are disabled.");
    }
    return Promise.resolve(null);
  }
  if (!clientPromise) {
    const generation = clientGeneration;
    clientPromise = import("pusher-js").then(({ default: PusherClient }) => {
      if (generation !== clientGeneration) {
        return null; // Disconnected (signed out) while pusher-js was downloading.
      }
      const pusher = new PusherClient(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        ...(PUSHER_HOST
          ? {
              wsHost: PUSHER_HOST,
              wsPort: PUSHER_PORT,
              wssPort: PUSHER_PORT,
              forceTLS: PUSHER_FORCE_TLS,
              enabledTransports: ["ws", "wss"],
            }
          : {}),
        channelAuthorization: {
          transport: "ajax",
          endpoint: PUSHER_AUTH_ENDPOINT,
          headersProvider: authHeaders,
        },
      });
      pusher.connection.bind("state_change", handleStateChange);
      client = pusher;
      channels.forEach((_, channelName) => attachChannel(pusher, channelName));
      return pusher;
    });
  }
  return clientPromise;
}

/** Listens for `event` on `channelName`. Returns the unsubscribe function. */
export function subscribe(channelName: string, event: string, handler: Handler) {
  const entry = channels.get(channelName) ?? {
    refs: 0,
    handlers: new Map<string, Set<Handler>>(),
    authRetried: false,
  };
  if (!channels.has(channelName)) {
    channels.set(channelName, entry);
    if (client) {
      attachChannel(client, channelName);
    }
  }
  entry.refs += 1;
  // A wrapper per call, so two subscribers passing the same function stay independent.
  const subscription: Handler = (data) => handler(data);
  const handlers = entry.handlers.get(event) ?? new Set<Handler>();
  handlers.add(subscription);
  entry.handlers.set(event, handlers);
  void loadClient();

  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    if (channels.get(channelName) !== entry) {
      return;
    }
    entry.handlers.get(event)?.delete(subscription);
    entry.refs -= 1;
    if (entry.refs <= 0) {
      channels.delete(channelName);
      client?.unsubscribe(channelName);
    }
  };
}

/** Called after the connection comes back from a drop, so screens can catch up on missed events. */
export function onConnectionRestored(listener: () => void) {
  restoredListeners.add(listener);
  return () => {
    restoredListeners.delete(listener);
  };
}

/** Closes the connection (sign-out). A later subscribe opens a new one with the new user's token. */
export function disconnectRealtime() {
  clientGeneration += 1;
  client?.disconnect();
  client = null;
  clientPromise = null;
  hasConnected = false;
}
