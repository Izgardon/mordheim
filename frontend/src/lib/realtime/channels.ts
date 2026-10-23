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
  removed_at?: string | null;
  removed_by?: "admin" | "author" | null;
};

/** `chat.removed`: an owner or admin removed a message (decision 8, CAMP-NEW-06). */
export type ChatRemoval = {
  id: number;
  campaign_id: number;
  removed_at: string;
  removed_by: "admin" | "author";
};

/** `campaign.updated` and friends on `private-campaign-{id}-events` (CAMP-NEW-07). */
export type CampaignEventMessage = Record<string, unknown>;

/**
 * `catalogue.changed` on the same channel (BUG-80): another member wrote one of the campaign's
 * catalogue lists. `kind` is the server's name for it ("items", "hired_swords", ...).
 */
export type CatalogueChange = { kind: string };

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

export function useCampaignChatRemovals(
  campaignId: number | null,
  handler: (removal: ChatRemoval) => void
) {
  useChannel<unknown>(
    campaignId ? `private-campaign-${campaignId}-chat` : null,
    "chat.removed",
    (data) => {
      if (data && typeof data === "object" && (data as { id?: unknown }).id) {
        handler(data as ChatRemoval);
      }
    }
  );
}

/** `campaign.updated` on the campaign's events channel (members only, CAMP-NEW-07). */
export function useCampaignUpdates(
  campaignId: number | null,
  handler: (campaign: CampaignEventMessage) => void
) {
  useChannel<unknown>(
    campaignId ? `private-campaign-${campaignId}-events` : null,
    "campaign.updated",
    (data) => {
      if (data && typeof data === "object" && (data as { id?: unknown }).id) {
        handler(data as CampaignEventMessage);
      }
    }
  );
}

/** `catalogue.changed` on the campaign's events channel (BUG-80). */
export function useCampaignCatalogueChanges(
  campaignId: number | null,
  handler: (change: CatalogueChange) => void
) {
  useChannel<unknown>(
    campaignId ? `private-campaign-${campaignId}-events` : null,
    "catalogue.changed",
    (data) => {
      const kind = data && typeof data === "object" ? (data as { kind?: unknown }).kind : null;
      if (typeof kind === "string" && kind) {
        handler({ kind });
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
