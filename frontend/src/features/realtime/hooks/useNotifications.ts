import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { invalidateOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { invalidatePendingResults } from "@/features/battles/hooks/usePendingReportedResults";
import {
  approveReportedBattleResult,
  declineBattleInvite,
  declineReportedBattleResult,
  joinBattle,
} from "@/features/battles/api/battles-api";
import type {
  BattleInviteNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import { acceptTradeRequest, declineTradeRequest } from "@/features/campaigns/api/campaigns-api";
import { clearAllNotifications as apiClearAllNotifications } from "@/features/notifications/api/notifications-api";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppStore } from "@/stores/app-store";
import { toCurrentBattleSession } from "@/features/battles/utils/battle-session";
import { setTradeData } from "@/features/warbands/api/economy-queries";

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
    currentBattleSession,
    setCurrentBattleSession,
    clearCurrentBattleSession,
  } = useAppStore();

  const acceptTradeNotification = useCallback(
    async (notification: TradeNotification) => {
      if (!user) {
        return;
      }
      const request = await acceptTradeRequest(notification.campaignId, notification.id);
      // The accepted trade is the trade query's: the warband page opens it from ?trade=.
      setTradeData(queryClient, request);
      removeTradeRequestNotification(notification.id);
      navigate(`/campaigns/${notification.campaignId}/warband?trade=${notification.id}`);
    },
    [navigate, queryClient, removeTradeRequestNotification, user]
  );

  const declineTradeNotification = useCallback(
    async (notification: TradeNotification) => {
      // The answer is the declined trade: its `trade_closed` then says nothing more here.
      setTradeData(
        queryClient,
        await declineTradeRequest(notification.campaignId, notification.id)
      );
      removeTradeRequestNotification(notification.id);
    },
    [queryClient, removeTradeRequestNotification]
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

  // The invite's X declines it (BUG-45): final; the server resolves the notification. Removed once
  // the server has it, so a failure shows on the card instead of the invite silently coming back.
  const declineBattleInviteNotification = useCallback(
    async (notification: BattleInviteNotification) => {
      await declineBattleInvite(notification.campaignId, notification.battleId);
      removeBattleInviteNotification(notification.id);
      if (currentBattleSession?.battleId === notification.battleId) {
        clearCurrentBattleSession();
      }
      void invalidateOpenBattles(queryClient, notification.campaignId);
    },
    [clearCurrentBattleSession, currentBattleSession, queryClient, removeBattleInviteNotification]
  );

  const acceptBattleResultRequestNotification = useCallback(
    async (notification: BattleResultRequestNotification) => {
      await approveReportedBattleResult(notification.campaignId, notification.battleId);
      removeBattleResultRequestNotification(notification.id);
      void invalidateOpenBattles(queryClient, notification.campaignId);
      void invalidatePendingResults(queryClient, notification.campaignId);
    },
    [queryClient, removeBattleResultRequestNotification]
  );

  const declineBattleResultRequestNotification = useCallback(
    async (notification: BattleResultRequestNotification) => {
      await declineReportedBattleResult(notification.campaignId, notification.battleId);
      removeBattleResultRequestNotification(notification.id);
      void invalidateOpenBattles(queryClient, notification.campaignId);
      void invalidatePendingResults(queryClient, notification.campaignId);
    },
    [queryClient, removeBattleResultRequestNotification]
  );

  const clearNotifications = useCallback(() => {
    clearTradeRequestNotifications();
    clearBattleInviteNotifications();
    clearBattleResultRequestNotifications();
    apiClearAllNotifications().catch((error: unknown) => {
      toast.error(getErrorMessage(error, "Couldn't clear your notifications."), {
        description: "They may come back the next time the list loads.",
      });
    });
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
    declineBattleInviteNotification,
    acceptBattleResultRequestNotification,
    declineBattleResultRequestNotification,
    clearNotifications,
  };
}
