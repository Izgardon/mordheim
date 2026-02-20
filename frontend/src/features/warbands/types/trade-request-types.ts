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
  status: "pending" | "accepted" | "declined" | "expired" | "completed";
  created_at: string;
  responded_at?: string | null;
  expires_at: string;
  from_offer?: TradeOffer;
  to_offer?: TradeOffer;
  from_accepted?: boolean;
  to_accepted?: boolean;
  from_user: TradeUserSummary;
  to_user: TradeUserSummary;
  from_warband: TradeWarbandSummary;
  to_warband: TradeWarbandSummary;
  channel: string;
};

export type TradeNotification = {
  id: string;
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
