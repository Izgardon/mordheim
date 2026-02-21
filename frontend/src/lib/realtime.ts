import { API_BASE_URL } from "@/config/env";
import { apiRequest } from "@/lib/api-client";
import { getToken } from "@/utils/storage";
import Pusher from "pusher-js";

type PingMessage = {
  type: "ping";
  from?: { id: number; label: string };
  campaign_id?: string | number;
  payload?: unknown;
  timestamp?: string;
};

type NotificationMessage = {
  type: string;
  payload?: unknown;
};

type TradeEventMessage = {
  type: string;
  payload?: unknown;
};

type PingSocket = {
  socket: Pusher | null;
  sendPing: (payload?: unknown) => void;
  close: () => void;
};

type NotificationSocket = {
  socket: Pusher | null;
  close: () => void;
};

type TradeSessionSocket = {
  socket: Pusher | null;
  close: () => void;
};

type BattleEventMessage = {
  type: string;
  payload?: unknown;
};

type BattleSessionSocket = {
  socket: Pusher | null;
  close: () => void;
};

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY as string | undefined;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER as string | undefined;
const PUSHER_AUTH_ENDPOINT = import.meta.env
  .VITE_PUSHER_AUTH_ENDPOINT as string | undefined;

const isPusherEnabled = () => Boolean(PUSHER_KEY && PUSHER_CLUSTER);

const ensurePusher = () => {
  if (isPusherEnabled()) {
    return true;
  }
  if (typeof window !== "undefined") {
    console.warn("Pusher is not configured. Realtime features are disabled.");
  }
  return false;
};

export const createCampaignPingSocket = (
  campaignId: number,
  onPing?: (message: PingMessage) => void
): PingSocket => {
  if (!ensurePusher()) {
    return {
      socket: null,
      sendPing: () => undefined,
      close: () => undefined,
    };
  }

  return createCampaignPingPusher(campaignId, onPing);
};

const createCampaignPingPusher = (
  campaignId: number,
  onPing?: (message: PingMessage) => void
): PingSocket => {
  const token = getToken();
  const channelName = `private-campaign-${campaignId}-pings`;
  const authEndpoint = PUSHER_AUTH_ENDPOINT || `${API_BASE_URL}/realtime/pusher/auth/`;

  const pusher = new Pusher(PUSHER_KEY as string, {
    cluster: PUSHER_CLUSTER as string,
    channelAuthorization: {
      transport: "ajax",
      endpoint: authEndpoint,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  });

  const channel = pusher.subscribe(channelName);

  const handlePing = (data: PingMessage) => {
    if (!data || data.type !== "ping") {
      return;
    }
    onPing?.(data);
  };

  channel.bind("ping", handlePing);

  const sendPing = (payload?: unknown) => {
    apiRequest(`/campaigns/${campaignId}/pings/`, {
      method: "POST",
      body: { payload },
    }).catch(() => undefined);
  };

  const close = () => {
    channel.unbind("ping", handlePing);
    pusher.unsubscribe(channelName);
    pusher.disconnect();
  };

  return { socket: pusher, sendPing, close };
};

export const createUserNotificationSocket = (
  userId: number,
  onMessage?: (message: NotificationMessage) => void
): NotificationSocket => {
  if (!ensurePusher()) {
    return {
      socket: null,
      close: () => undefined,
    };
  }

  const token = getToken();
  const channelName = `private-user-${userId}-notifications`;
  const authEndpoint = PUSHER_AUTH_ENDPOINT || `${API_BASE_URL}/realtime/pusher/auth/`;

  const pusher = new Pusher(PUSHER_KEY as string, {
    cluster: PUSHER_CLUSTER as string,
    channelAuthorization: {
      transport: "ajax",
      endpoint: authEndpoint,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  });

  const channel = pusher.subscribe(channelName);
  const handleNotification = (data: NotificationMessage) => {
    if (!data || !data.type) {
      return;
    }
    onMessage?.(data);
  };
  channel.bind("notification", handleNotification);

  const close = () => {
    channel.unbind("notification", handleNotification);
    pusher.unsubscribe(channelName);
    pusher.disconnect();
  };

  return { socket: pusher, close };
};

export const createTradeSessionSocket = (
  tradeRequestId: string,
  onEvent?: (message: TradeEventMessage) => void
): TradeSessionSocket => {
  if (!ensurePusher()) {
    return {
      socket: null,
      close: () => undefined,
    };
  }

  const token = getToken();
  const channelName = `private-trade-${tradeRequestId}`;
  const authEndpoint = PUSHER_AUTH_ENDPOINT || `${API_BASE_URL}/realtime/pusher/auth/`;

  const pusher = new Pusher(PUSHER_KEY as string, {
    cluster: PUSHER_CLUSTER as string,
    channelAuthorization: {
      transport: "ajax",
      endpoint: authEndpoint,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  });

  const channel = pusher.subscribe(channelName);
  const handleEvent = (data: TradeEventMessage) => {
    if (!data || !data.type) {
      return;
    }
    onEvent?.(data);
  };
  channel.bind("trade.event", handleEvent);

  const close = () => {
    channel.unbind("trade.event", handleEvent);
    pusher.unsubscribe(channelName);
    pusher.disconnect();
  };

  return { socket: pusher, close };
};

export const createBattleSessionSocket = (
  battleId: number,
  onEvent?: (message: BattleEventMessage) => void
): BattleSessionSocket => {
  if (!ensurePusher()) {
    return {
      socket: null,
      close: () => undefined,
    };
  }

  const token = getToken();
  const channelName = `private-battle-${battleId}`;
  const authEndpoint = PUSHER_AUTH_ENDPOINT || `${API_BASE_URL}/realtime/pusher/auth/`;

  const pusher = new Pusher(PUSHER_KEY as string, {
    cluster: PUSHER_CLUSTER as string,
    channelAuthorization: {
      transport: "ajax",
      endpoint: authEndpoint,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  });

  const channel = pusher.subscribe(channelName);
  const handleEvent = (data: BattleEventMessage) => {
    if (!data || !data.type) {
      return;
    }
    onEvent?.(data);
  };
  channel.bind("battle.event", handleEvent);

  const close = () => {
    channel.unbind("battle.event", handleEvent);
    pusher.unsubscribe(channelName);
    pusher.disconnect();
  };

  return { socket: pusher, close };
};

export type {
  PingMessage,
  PingSocket,
  NotificationMessage,
  NotificationSocket,
  TradeEventMessage,
  TradeSessionSocket,
  BattleEventMessage,
  BattleSessionSocket,
};
