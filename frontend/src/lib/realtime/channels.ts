import { useChannel } from "./use-channel";

/** Typed wrappers for the app's private channels (names and events match the backend). */

export type NotificationMessage = {
  type: string;
  payload?: unknown;
};

export type TradeEventMessage = {
  type: string;
  payload?: unknown;
};

export type BattleEventMessage = {
  type: string;
  payload?: unknown;
};

export type ChatMessage = {
  id: number;
  campaign_id: number;
  user_id: number | null;
  username: string;
  body: string;
  created_at: string;
};

const hasType = (data: unknown): data is { type: string } =>
  Boolean(data && typeof data === "object" && (data as { type?: unknown }).type);

/** Notifications for the signed-in user (invites, trade requests, battle results). */
export function useUserNotifications(
  userId: number | null,
  handler: (message: NotificationMessage) => void
) {
  useChannel<unknown>(
    userId ? `private-user-${userId}-notifications` : null,
    "notification",
    (data) => {
      if (hasType(data)) handler(data);
    }
  );
}

export function useCampaignChatMessages(
  campaignId: number | null,
  handler: (message: ChatMessage) => void
) {
  useChannel<unknown>(
    campaignId ? `private-campaign-${campaignId}-chat` : null,
    "chat.message",
    (data) => {
      if (data && typeof data === "object" && (data as { id?: unknown }).id) {
        handler(data as ChatMessage);
      }
    }
  );
}

export function useTradeEvents(
  tradeRequestId: string | null,
  handler: (message: TradeEventMessage) => void
) {
  useChannel<unknown>(
    tradeRequestId ? `private-trade-${tradeRequestId}` : null,
    "trade.event",
    (data) => {
      if (hasType(data)) handler(data);
    }
  );
}

export function useBattleEvents(
  battleId: number | null,
  handler: (message: BattleEventMessage) => void
) {
  useChannel<unknown>(battleId ? `private-battle-${battleId}` : null, "battle.event", (data) => {
    if (hasType(data)) handler(data);
  });
}
