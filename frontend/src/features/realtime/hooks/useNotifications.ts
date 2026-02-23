import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { joinBattle } from "@/features/battles/api/battles-api";
import type { BattleInviteNotification } from "@/features/battles/types/battle-types";
import {
  acceptTradeRequest,
  declineTradeRequest,
  listPendingTradeRequests,
} from "@/features/campaigns/api/campaigns-api";
import type { TradeRequest, TradeNotification, TradeSession } from "@/features/warbands/types/trade-request-types";
import { createUserNotificationSocket } from "@/lib/realtime";
import { useAppStore } from "@/stores/app-store";

const toNotification = (request: TradeRequest): TradeNotification => ({
  id: request.id,
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
  created_by_user_id?: number;
  created_by_user_label?: string;
};

const toBattleInviteNotification = (
  payload: BattleNotificationPayload
): BattleInviteNotification | null => {
  if (!payload?.battle_id || !payload?.campaign_id) {
    return null;
  }
  return {
    id: `battle-${payload.battle_id}`,
    battleId: payload.battle_id,
    campaignId: payload.campaign_id,
    title: payload.title?.trim() || `Battle #${payload.battle_id}`,
    scenario: payload.scenario?.trim() || "",
    createdByUserId:
      typeof payload.created_by_user_id === "number" ? payload.created_by_user_id : null,
    createdByLabel: payload.created_by_user_label?.trim() || "",
    createdAt: new Date().toISOString(),
  };
};

export function useNotifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tradeRequestNotifications,
    battleInviteNotifications,
    tradeSession,
    addTradeRequestNotification,
    removeTradeRequestNotification,
    clearTradeRequestNotifications,
    addBattleInviteNotification,
    removeBattleInviteNotification,
    clearBattleInviteNotifications,
    setTradeSession,
  } = useAppStore();

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    listPendingTradeRequests()
      .then((requests) => {
        if (!active) {
          return;
        }
        requests.forEach((request) => {
          if (request?.id) {
            addTradeRequestNotification(toNotification(request));
          }
        });
      })
      .catch(() => {});

    const socket = createUserNotificationSocket(user.id, (message) => {
      if (!message?.type) {
        return;
      }

      if (message.type === "trade_request") {
        const request = message.payload as TradeRequest;
        if (!request?.id) {
          return;
        }
        addTradeRequestNotification(toNotification(request));
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
        const notification = toBattleInviteNotification(payload);
        if (!notification) {
          return;
        }
        addBattleInviteNotification(notification);
        window.dispatchEvent(
          new CustomEvent("battle:invite", {
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
    addTradeRequestNotification,
    addBattleInviteNotification,
    navigate,
    removeBattleInviteNotification,
    removeTradeRequestNotification,
    setTradeSession,
    tradeSession?.requestId,
    tradeSession?.status,
    user,
  ]);

  const acceptNotification = useCallback(
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

  const declineNotification = useCallback(
    async (notification: TradeNotification) => {
      await declineTradeRequest(notification.campaignId, notification.id);
      removeTradeRequestNotification(notification.id);
    },
    [removeTradeRequestNotification]
  );

  const acceptBattleInviteNotification = useCallback(
    async (notification: BattleInviteNotification) => {
      const updatedBattle = await joinBattle(notification.campaignId, notification.battleId);
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
    [navigate, removeBattleInviteNotification]
  );

  const dismissBattleInviteNotification = useCallback(
    (notification: BattleInviteNotification) => {
      removeBattleInviteNotification(notification.id);
    },
    [removeBattleInviteNotification]
  );

  const clearNotifications = useCallback(() => {
    clearTradeRequestNotifications();
    clearBattleInviteNotifications();
  }, [clearBattleInviteNotifications, clearTradeRequestNotifications]);

  return {
    tradeRequestNotifications,
    battleInviteNotifications,
    acceptTradeNotification: acceptNotification,
    declineTradeNotification: declineNotification,
    acceptBattleInviteNotification,
    dismissBattleInviteNotification,
    clearNotifications,
  };
}
