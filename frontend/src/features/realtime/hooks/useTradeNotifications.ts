import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
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

export function useTradeNotifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tradeNotifications,
    tradeSession,
    addTradeNotification,
    removeTradeNotification,
    clearTradeNotifications,
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
            addTradeNotification(toNotification(request));
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
        addTradeNotification(toNotification(request));
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
        removeTradeNotification(request.id);
        if (tradeSession?.requestId === request.id) {
          setTradeSession(null);
        }
      }
    });

    return () => {
      active = false;
      socket.close();
    };
  }, [
    addTradeNotification,
    navigate,
    removeTradeNotification,
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
      removeTradeNotification(notification.id);
      navigate(`/campaigns/${notification.campaignId}/warband?trade=${notification.id}`);
    },
    [navigate, removeTradeNotification, setTradeSession, user]
  );

  const declineNotification = useCallback(
    async (notification: TradeNotification) => {
      await declineTradeRequest(notification.campaignId, notification.id);
      removeTradeNotification(notification.id);
    },
    [removeTradeNotification]
  );

  return {
    notifications: tradeNotifications,
    acceptNotification,
    declineNotification,
    clearNotifications: clearTradeNotifications,
  };
}
