import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { invalidateOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import {
  approveReportedBattleResult,
  declineReportedBattleResult,
  joinBattle,
} from "@/features/battles/api/battles-api";
import type {
  BattleInviteNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import { acceptTradeRequest, declineTradeRequest } from "@/features/campaigns/api/campaigns-api";
import {
  clearAllNotifications as apiClearAllNotifications,
  clearNotification as apiClearNotification,
} from "@/features/notifications/api/notifications-api";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import { useAppStore } from "@/stores/app-store";
import { toCurrentBattleSession } from "@/features/battles/utils/battle-session";
import { toTradeSession } from "../utils/notification-mappers";

/** The notification lists and their actions (accept, decline, dismiss, clear). */
export function useNotifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    tradeRequestNotifications,
    battleInviteNotifications,
    battleResultRequestNotifications,
    removeTradeRequestNotification,
    clearTradeRequestNotifications,
    removeBattleInviteNotification,
    clearBattleInviteNotifications,
    removeBattleResultRequestNotification,
    clearBattleResultRequestNotifications,
    setCurrentBattleSession,
    setTradeSession,
  } = useAppStore();

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
      void invalidateOpenBattles(queryClient, notification.campaignId);
      if (updatedBattle.battle.status === "prebattle") {
        navigate(
          `/campaigns/${notification.campaignId}/battles/${notification.battleId}/prebattle`
        );
      }
    },
    [navigate, queryClient, removeBattleInviteNotification, setCurrentBattleSession]
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
      void invalidateOpenBattles(queryClient, notification.campaignId);
    },
    [queryClient, removeBattleResultRequestNotification]
  );

  const declineBattleResultRequestNotification = useCallback(
    async (notification: BattleResultRequestNotification) => {
      await declineReportedBattleResult(notification.campaignId, notification.battleId);
      removeBattleResultRequestNotification(notification.id);
      void invalidateOpenBattles(queryClient, notification.campaignId);
    },
    [queryClient, removeBattleResultRequestNotification]
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
