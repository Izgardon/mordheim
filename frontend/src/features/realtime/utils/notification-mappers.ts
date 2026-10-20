import type {
  BattleInviteNotification,
  BattleNudgeNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import type { AppNotification } from "@/features/notifications/api/notifications-api";
import type {
  TradeNotification,
  TradeRequest,
} from "@/features/warbands/types/trade-request-types";

/** Pure conversions from notification payloads (REST list and realtime events) to store items. */

export const toTradeNotification = (
  request: TradeRequest,
  notificationDbId: number
): TradeNotification => ({
  id: request.id,
  notificationDbId,
  campaignId: request.campaign_id,
  fromUser: request.from_user,
  fromWarband: request.from_warband,
  toWarband: request.to_warband,
  createdAt: request.created_at,
  expiresAt: request.expires_at,
});

export type BattleNotificationPayload = {
  battle_id?: number;
  campaign_id?: number;
  status?: string;
  title?: string;
  scenario?: string;
  battle_date?: string;
  winner_warband_ids?: number[];
  winner_warband_names?: string[];
  created_by_user_id?: number;
  created_by_user_label?: string;
  notification_id?: number;
};

export const toBattleInviteNotification = (
  payload: BattleNotificationPayload,
  notificationDbId: number
): BattleInviteNotification | null => {
  if (!payload?.battle_id || !payload?.campaign_id) {
    return null;
  }
  return {
    id: `battle-${payload.battle_id}`,
    notificationDbId,
    battleId: payload.battle_id,
    campaignId: payload.campaign_id,
    title: payload.title?.trim() || `Battle #${payload.battle_id}`,
    scenario: payload.scenario?.trim() || "",
    battleDate: payload.battle_date?.trim() || "",
    createdByUserId:
      typeof payload.created_by_user_id === "number" ? payload.created_by_user_id : null,
    createdByLabel: payload.created_by_user_label?.trim() || "",
    createdAt: new Date().toISOString(),
  };
};

export const toBattleResultRequestNotification = (
  payload: BattleNotificationPayload,
  notificationDbId: number
): BattleResultRequestNotification | null => {
  if (!payload?.battle_id || !payload?.campaign_id) {
    return null;
  }
  const winnerWarbandIds = Array.isArray(payload.winner_warband_ids)
    ? payload.winner_warband_ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : [];
  const winnerWarbandNames = Array.isArray(payload.winner_warband_names)
    ? payload.winner_warband_names.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      )
    : [];
  return {
    id: `battle-result-${payload.battle_id}`,
    notificationDbId,
    battleId: payload.battle_id,
    campaignId: payload.campaign_id,
    title: payload.title?.trim() || payload.scenario?.trim() || "Reported Battle Result",
    scenario: payload.scenario?.trim() || "",
    battleDate: payload.battle_date?.trim() || "",
    winnerWarbandIds,
    winnerWarbandNames,
    createdByUserId:
      typeof payload.created_by_user_id === "number" ? payload.created_by_user_id : null,
    createdByLabel: payload.created_by_user_label?.trim() || "",
    createdAt: new Date().toISOString(),
  };
};

/** A nudge's payload (`battle_nudge`): who nudged you about which battle, and its page. */
export const toBattleNudgeNotification = (
  payload: BattleNotificationPayload & {
    page?: BattleNudgeNotification["page"];
    nudged_by_user_label?: string;
    nudged_at?: string;
  },
  notificationDbId: number
): BattleNudgeNotification | null => {
  if (!payload?.battle_id || !payload?.campaign_id) {
    return null;
  }
  return {
    id: `battle-nudge-${payload.battle_id}`,
    notificationDbId,
    battleId: payload.battle_id,
    campaignId: payload.campaign_id,
    scenario: payload.scenario?.trim() || `Battle #${payload.battle_id}`,
    page: payload.page ?? null,
    fromLabel: payload.nudged_by_user_label?.trim() || "A player",
    createdAt: payload.nudged_at || new Date().toISOString(),
  };
};

export const notificationFromApi = (
  n: AppNotification
): BattleInviteNotification | BattleResultRequestNotification | TradeNotification | null => {
  if (n.notification_type === "trade_request") {
    const request = n.payload as TradeRequest;
    if (!request?.id) return null;
    return { ...toTradeNotification(request, n.id), createdAt: n.created_at };
  }
  if (n.notification_type === "battle_invite") {
    const payload = n.payload as BattleNotificationPayload;
    const notif = toBattleInviteNotification(payload, n.id);
    if (!notif) return null;
    return { ...notif, createdAt: n.created_at };
  }
  if (n.notification_type === "battle_result_request") {
    const payload = n.payload as BattleNotificationPayload;
    const notif = toBattleResultRequestNotification(payload, n.id);
    if (!notif) return null;
    return { ...notif, createdAt: n.created_at };
  }
  return null;
};
