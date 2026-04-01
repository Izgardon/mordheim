import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  approveReportedBattleResult,
  declineReportedBattleResult,
  joinBattle,
} from "@/features/battles/api/battles-api";
import type {
  BattleInviteNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import {
  acceptTradeRequest,
  declineTradeRequest,
} from "@/features/campaigns/api/campaigns-api";
import {
  clearAllNotifications as apiClearAllNotifications,
  clearNotification as apiClearNotification,
  listNotifications,
} from "@/features/notifications/api/notifications-api";
import type { AppNotification } from "@/features/notifications/api/notifications-api";
import type { TradeNotification, TradeRequest, TradeSession } from "@/features/warbands/types/trade-request-types";
import { createUserNotificationSocket } from "@/lib/realtime";
import { useAppStore } from "@/stores/app-store";
import { toCurrentBattleSession } from "@/features/battles/utils/battle-session";

const toNotification = (request: TradeRequest, notificationDbId: number): TradeNotification => ({
  id: request.id,
  notificationDbId,
  campaignId: request.campaign_id,
  fromUser: request.from_user,
  fromWarband: request.from_warband,
  toWarband: request.to_warband,
  createdAt: request.created_at,
  expiresAt: request.expires_at,
});

const toTradeSession = (request: TradeRequest, userId: number, status: "pending" | "active"): TradeSession => {
  const role = request.from_user.id === userId ? "initiator" : "recipient";
  return {
    requestId: request.id,
    campaignId: request.campaign_id,
    partner: role === "initiator" ? request.to_user : request.from_user,
    fromWarband: request.from_warband,
    toWarband: request.to_warband,
    status,
    expiresAt: request.expires_at,
    role,
  };
};

type BattleNotificationPayload = {
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

const toBattleInviteNotification = (
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

const toBattleResultRequestNotification = (
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

const notificationFromApi = (
  n: AppNotification
): BattleInviteNotification | BattleResultRequestNotification | TradeNotification | null => {
  if (n.notification_type === "trade_request") {
    const request = n.payload as TradeRequest;
    if (!request?.id) return null;
    return { ...toNotification(request, n.id), createdAt: n.created_at };
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

export function useNotifications(connect = true) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tradeRequestNotifications,
    battleInviteNotifications,
    battleResultRequestNotifications,
    tradeSession,
    addTradeRequestNotification,
    removeTradeRequestNotification,
    clearTradeRequestNotifications,
    addBattleInviteNotification,
    removeBattleInviteNotification,
    clearBattleInviteNotifications,
    addBattleResultRequestNotification,
    removeBattleResultRequestNotification,
    clearBattleResultRequestNotifications,
    currentBattleSession,
    setCurrentBattleSession,
    clearCurrentBattleSession,
    setTradeSession,
  } = useAppStore();

  useEffect(() => {
    if (!connect) {
      return;
    }
    if (!user) {
      return;
    }

    let active = true;

    // Load all pending notifications from the database on mount
    listNotifications()
      .then((notifications) => {
        if (!active) return;
        for (const n of notifications) {
          const converted = notificationFromApi(n);
          if (!converted) continue;
          if (n.notification_type === "trade_request") {
            addTradeRequestNotification(converted as TradeNotification);
          } else if (n.notification_type === "battle_invite") {
            const battleInvite = converted as BattleInviteNotification;
            addBattleInviteNotification(battleInvite);
            setCurrentBattleSession({
              battleId: battleInvite.battleId,
              campaignId: battleInvite.campaignId,
              status: "inviting",
            });
          } else if (n.notification_type === "battle_result_request") {
            addBattleResultRequestNotification(converted as BattleResultRequestNotification);
          }
        }
      })
      .catch(() => {});

    const socket = createUserNotificationSocket(user.id, (message) => {
      if (!message?.type) {
        return;
      }

      if (message.type === "trade_request") {
        const request = message.payload as TradeRequest & { notification_id?: number };
        if (!request?.id) {
          return;
        }
        addTradeRequestNotification(toNotification(request, request.notification_id ?? 0));
        return;
      }

      if (message.type === "trade_accepted") {
        const request = message.payload as TradeRequest;
        if (!request?.id) {
          return;
        }
        if (tradeSession?.requestId === request.id && tradeSession.status === "active") {
          return;
        }
        setTradeSession(toTradeSession(request, user.id, "active"));
        navigate(`/campaigns/${request.campaign_id}/warband?trade=${request.id}`);
        return;
      }

      if (message.type === "trade_declined") {
        const request = message.payload as TradeRequest;
        if (!request?.id) {
          return;
        }
        removeTradeRequestNotification(request.id);
        if (tradeSession?.requestId === request.id) {
          setTradeSession(null);
        }
        return;
      }

      if (message.type === "battle_invite") {
        const payload = message.payload as BattleNotificationPayload;
        const notification = toBattleInviteNotification(payload, payload.notification_id ?? 0);
        if (!notification) {
          return;
        }
        addBattleInviteNotification(notification);
        setCurrentBattleSession({
          battleId: notification.battleId,
          campaignId: notification.campaignId,
          status: payload.status === "prebattle" ? "prebattle" : "inviting",
        });
        window.dispatchEvent(
          new CustomEvent("battle:invite", {
            detail: payload,
          })
        );
        return;
      }

      if (message.type === "battle_result_request") {
        const payload = message.payload as BattleNotificationPayload;
        const notification = toBattleResultRequestNotification(payload, payload.notification_id ?? 0);
        if (!notification) {
          return;
        }
        addBattleResultRequestNotification(notification);
        window.dispatchEvent(
          new CustomEvent("battle:result-request", {
            detail: payload,
          })
        );
        return;
      }

      if (message.type === "battle_result_updated") {
        const payload = message.payload as BattleNotificationPayload;
        if (!payload?.battle_id || !payload?.campaign_id) {
          return;
        }
        if (
          currentBattleSession?.battleId === payload.battle_id &&
          (payload.status === "ended" || payload.status === "canceled")
        ) {
          clearCurrentBattleSession();
        }
        removeBattleResultRequestNotification(`battle-result-${payload.battle_id}`);
        window.dispatchEvent(
          new CustomEvent("battle:status-updated", {
            detail: payload,
          })
        );
        return;
      }

      if (message.type === "battle_prebattle_opened") {
        const payload = message.payload as BattleNotificationPayload;
        if (!payload?.battle_id || !payload?.campaign_id) {
          return;
        }
        setCurrentBattleSession({
          battleId: payload.battle_id,
          campaignId: payload.campaign_id,
          status: "prebattle",
        });
        removeBattleInviteNotification(`battle-${payload.battle_id}`);
        window.dispatchEvent(
          new CustomEvent("battle:prebattle-opened", {
            detail: payload,
          })
        );
        navigate(`/campaigns/${payload.campaign_id}/battles/${payload.battle_id}/prebattle`);
      }
    });

    return () => {
      active = false;
      socket.close();
    };
  }, [
    connect,
    addTradeRequestNotification,
    addBattleInviteNotification,
    addBattleResultRequestNotification,
    clearCurrentBattleSession,
    currentBattleSession?.battleId,
    navigate,
    removeBattleInviteNotification,
    removeBattleResultRequestNotification,
    removeTradeRequestNotification,
    setCurrentBattleSession,
    setTradeSession,
    tradeSession?.requestId,
    tradeSession?.status,
    user,
  ]);

  const acceptTradeNotification = useCallback(
    async (notification: TradeNotification) => {
      if (!user) {
        return;
      }
      const request = await acceptTradeRequest(notification.campaignId, notification.id);
      setTradeSession(toTradeSession(request, user.id, "active"));
      removeTradeRequestNotification(notification.id);
      navigate(`/campaigns/${notification.campaignId}/warband?trade=${notification.id}`);
    },
    [navigate, removeTradeRequestNotification, setTradeSession, user]
  );

  const declineTradeNotification = useCallback(
    async (notification: TradeNotification) => {
      await declineTradeRequest(notification.campaignId, notification.id);
      removeTradeRequestNotification(notification.id);
    },
    [removeTradeRequestNotification]
  );

  const acceptBattleInviteNotification = useCallback(
    async (notification: BattleInviteNotification) => {
      const updatedBattle = await joinBattle(notification.campaignId, notification.battleId);
      setCurrentBattleSession(toCurrentBattleSession(updatedBattle));
      removeBattleInviteNotification(notification.id);
      window.dispatchEvent(
        new CustomEvent("battle:status-updated", {
          detail: {
            campaign_id: notification.campaignId,
            battle_id: notification.battleId,
            status: updatedBattle.battle.status,
          },
        })
      );
      if (updatedBattle.battle.status === "prebattle") {
        navigate(`/campaigns/${notification.campaignId}/battles/${notification.battleId}/prebattle`);
      }
    },
    [navigate, removeBattleInviteNotification, setCurrentBattleSession]
  );

  const dismissBattleInviteNotification = useCallback(
    (notification: BattleInviteNotification) => {
      removeBattleInviteNotification(notification.id);
      if (notification.notificationDbId) {
        void apiClearNotification(notification.notificationDbId);
      }
    },
    [removeBattleInviteNotification]
  );

  const acceptBattleResultRequestNotification = useCallback(
    async (notification: BattleResultRequestNotification) => {
      await approveReportedBattleResult(notification.campaignId, notification.battleId);
      removeBattleResultRequestNotification(notification.id);
      window.dispatchEvent(
        new CustomEvent("battle:status-updated", {
          detail: {
            campaign_id: notification.campaignId,
            battle_id: notification.battleId,
            status: "reported_result_pending",
          },
        })
      );
    },
    [removeBattleResultRequestNotification]
  );

  const declineBattleResultRequestNotification = useCallback(
    async (notification: BattleResultRequestNotification) => {
      await declineReportedBattleResult(notification.campaignId, notification.battleId);
      removeBattleResultRequestNotification(notification.id);
      window.dispatchEvent(
        new CustomEvent("battle:status-updated", {
          detail: {
            campaign_id: notification.campaignId,
            battle_id: notification.battleId,
            status: "canceled",
          },
        })
      );
    },
    [removeBattleResultRequestNotification]
  );

  const clearNotifications = useCallback(() => {
    clearTradeRequestNotifications();
    clearBattleInviteNotifications();
    clearBattleResultRequestNotifications();
    void apiClearAllNotifications();
  }, [
    clearBattleInviteNotifications,
    clearBattleResultRequestNotifications,
    clearTradeRequestNotifications,
  ]);

  return {
    tradeRequestNotifications,
    battleInviteNotifications,
    battleResultRequestNotifications,
    acceptTradeNotification,
    declineTradeNotification,
    acceptBattleInviteNotification,
    dismissBattleInviteNotification,
    acceptBattleResultRequestNotification,
    declineBattleResultRequestNotification,
    clearNotifications,
  };
}
