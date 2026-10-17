import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import type {
  BattleInviteNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import { listNotifications } from "@/features/notifications/api/notifications-api";
import type {
  TradeNotification,
  TradeRequest,
} from "@/features/warbands/types/trade-request-types";
import { useUserNotifications } from "@/lib/realtime";
import { useAppStore } from "@/stores/app-store";
import {
  notificationFromApi,
  toBattleInviteNotification,
  toBattleResultRequestNotification,
  toTradeNotification,
  toTradeSession,
  type BattleNotificationPayload,
} from "../utils/notification-mappers";

/**
 * Loads the signed-in user's pending notifications once and listens on their notification
 * channel. Mount once, above every protected screen.
 */
export function useNotificationSubscription() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tradeSession,
    currentBattleSession,
    addTradeRequestNotification,
    removeTradeRequestNotification,
    addBattleInviteNotification,
    removeBattleInviteNotification,
    addBattleResultRequestNotification,
    removeBattleResultRequestNotification,
    setCurrentBattleSession,
    clearCurrentBattleSession,
    setTradeSession,
  } = useAppStore();
  const userId = user?.id ?? null;

  // Only a different user reloads the list; store changes (battle or trade session) don't.
  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
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
    return () => {
      active = false;
    };
  }, [
    addBattleInviteNotification,
    addBattleResultRequestNotification,
    addTradeRequestNotification,
    setCurrentBattleSession,
    userId,
  ]);

  useUserNotifications(userId, (message) => {
    if (!userId) {
      return;
    }

    if (message.type === "trade_request") {
      const request = message.payload as TradeRequest & { notification_id?: number };
      if (!request?.id) {
        return;
      }
      addTradeRequestNotification(toTradeNotification(request, request.notification_id ?? 0));
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
      setTradeSession(toTradeSession(request, userId, "active"));
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
      window.dispatchEvent(new CustomEvent("battle:invite", { detail: payload }));
      return;
    }

    if (message.type === "battle_result_request") {
      const payload = message.payload as BattleNotificationPayload;
      const notification = toBattleResultRequestNotification(payload, payload.notification_id ?? 0);
      if (!notification) {
        return;
      }
      addBattleResultRequestNotification(notification);
      window.dispatchEvent(new CustomEvent("battle:result-request", { detail: payload }));
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
      window.dispatchEvent(new CustomEvent("battle:status-updated", { detail: payload }));
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
      window.dispatchEvent(new CustomEvent("battle:prebattle-opened", { detail: payload }));
      navigate(`/campaigns/${payload.campaign_id}/battles/${payload.battle_id}/prebattle`);
    }
  });
}
