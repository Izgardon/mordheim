import type { WarbandUnitsSummary } from "./warband-types";

export type TradeUserSummary = {
  id: number;
  label: string;
};

export type TradeWarbandSummary = {
  id: number;
  name: string;
};

export type TradeOfferItem = {
  id: number;
  name: string;
  quantity: number;
  cost?: number | null;
};

export type TradeOffer = {
  trader_id?: number | null;
  trader_name?: string | null;
  gold?: number | null;
  items?: TradeOfferItem[];
};

export type TradeRequest = {
  id: string;
  campaign_id: number;
  /** "cancelled": the sender closed it; "declined": the recipient turned it down or closed it. */
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired" | "completed";
  created_at: string;
  responded_at?: string | null;
  expires_at: string;
  from_offer?: TradeOffer;
  to_offer?: TradeOffer;
  from_accepted?: boolean;
  to_accepted?: boolean;
  /** Goes up with every saved offer; a lock names the one its player was shown (BUG-35). */
  offer_version?: number;
  from_user: TradeUserSummary;
  to_user: TradeUserSummary;
  from_warband: TradeWarbandSummary;
  to_warband: TradeWarbandSummary;
  channel: string;
};

/**
 * A completed trade as the completing lock answers it and `trade.completed` carries it: the
 * request plus each warband's summary, so neither player re-reads its own (ECON-PERF-02).
 */
export type TradeCompletion = TradeRequest & {
  from_summary?: WarbandUnitsSummary;
  to_summary?: WarbandUnitsSummary;
};

export type TradeNotification = {
  id: string;
  notificationDbId: number;
  campaignId: number;
  fromUser: TradeUserSummary;
  fromWarband: TradeWarbandSummary;
  toWarband: TradeWarbandSummary;
  createdAt: string;
  expiresAt: string;
};

export type TradeSession = {
  requestId: string;
  campaignId: number;
  partner: TradeUserSummary;
  fromWarband: TradeWarbandSummary;
  toWarband: TradeWarbandSummary;
  status: "pending" | "active";
  expiresAt: string;
  role: "initiator" | "recipient";
};
