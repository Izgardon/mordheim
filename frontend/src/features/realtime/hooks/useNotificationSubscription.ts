import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { invalidateOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { invalidatePendingResults } from "@/features/battles/hooks/usePendingReportedResults";
import { listNotifications } from "@/features/notifications/api/notifications-api";
import { useRealtimeReconnect, useUserNotifications } from "@/lib/realtime";
import { useAppStore } from "@/stores/app-store";
import {
  toBattleInviteNotification,
  toBattleNudgeNotification,
  toBattleResultRequestNotification,
  type BattleNotificationPayload,
} from "../utils/notification-mappers";
import { handleMembershipNotification } from "../utils/membership-notifications";
import { handleTradeNotification } from "../utils/trade-notifications";
import { useApplyNotificationList, useReloadNotifications } from "./useNotificationList";

/** Long enough to read and act on; the Rejoin Battle button and the bell remain afterwards. */
const ACTIONABLE_TOAST_MS = 12_000;

/**
 * Loads the signed-in user's pending notifications, listens on their notification channel and
 * reloads the list after a reconnect. Mounted once, by RealtimeProvider.
 */
export function useNotificationSubscription() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    currentBattleSession,
    addTradeRequestNotification,
    removeTradeRequestNotification,
    addBattleInviteNotification,
    removeBattleInviteNotification,
    addBattleResultRequestNotification,
    removeBattleResultRequestNotification,
    addBattleNudgeNotification,
    setCurrentBattleSession,
    clearCurrentBattleSession,
  } = useAppStore();
  const userId = user?.id ?? null;
  const applyNotificationList = useApplyNotificationList();
  const reloadNotifications = useReloadNotifications();

  // Only a different user reloads the list; store changes (battle or trade session) don't.
  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    listNotifications()
      .then((notifications) => {
        if (active) applyNotificationList(notifications, { replace: false });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [applyNotificationList, userId]);

  // Notifications sent while the socket was down are only in the database: reload the list.
  useRealtimeReconnect(reloadNotifications);

  useUserNotifications(userId, (message) => {
    if (!userId) {
      return;
    }

    const tradeContext = {
      queryClient,
      userId,
      location,
      navigate,
      addTradeRequestNotification,
      removeTradeRequestNotification,
    };
    if (handleTradeNotification(message, tradeContext)) {
      return;
    }
    const membershipContext = {
      queryClient,
      location,
      navigate,
      reloadNotifications,
      currentBattleCampaignId: currentBattleSession?.campaignId ?? null,
      clearCurrentBattleSession,
    };
    if (handleMembershipNotification(message, membershipContext)) {
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
      void invalidateOpenBattles(queryClient, notification.campaignId);
      return;
    }

    if (message.type === "battle_result_request") {
      const payload = message.payload as BattleNotificationPayload;
      const notification = toBattleResultRequestNotification(payload, payload.notification_id ?? 0);
      if (!notification) {
        return;
      }
      addBattleResultRequestNotification(notification);
      void invalidatePendingResults(queryClient, notification.campaignId);
      return;
    }

    if (message.type === "battle_nudge") {
      // Another player is waiting for you (BATL-NEW-08): a toast that goes there, and the bell.
      const payload = message.payload as BattleNotificationPayload;
      const nudge = toBattleNudgeNotification(payload, payload.notification_id ?? 0);
      if (!nudge) {
        return;
      }
      addBattleNudgeNotification(nudge);
      const page = nudge.page
        ? `/campaigns/${nudge.campaignId}/battles/${nudge.battleId}/${nudge.page}`
        : null;
      toast(`${nudge.fromLabel} nudged you: ${nudge.scenario} is waiting for you.`, {
        id: `battle-nudge-${nudge.battleId}`,
        duration: ACTIONABLE_TOAST_MS,
        ...(page && !location.pathname.startsWith(page)
          ? { action: { label: "Go", onClick: () => navigate(page) } }
          : {}),
      });
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
      void invalidateOpenBattles(queryClient, payload.campaign_id);
      void invalidatePendingResults(queryClient, payload.campaign_id);
      return;
    }

    if (message.type === "battle_canceled") {
      // A battle you were in was cancelled (its creator, or a battle manager from Settings): off
      // its page only this says so, so its invite and your Rejoin for it go here.
      const payload = message.payload as BattleNotificationPayload;
      if (!payload?.battle_id || !payload?.campaign_id) {
        return;
      }
      if (currentBattleSession?.battleId === payload.battle_id) {
        clearCurrentBattleSession();
      }
      removeBattleInviteNotification(`battle-${payload.battle_id}`);
      void invalidateOpenBattles(queryClient, payload.campaign_id);
      return;
    }

    if (message.type === "battle_invite_declined") {
      // An invitee declined your battle, or didn't answer in time (BUG-45, decision 2).
      const payload = message.payload as BattleNotificationPayload & {
        user_label?: string;
        reason?: string;
      };
      if (!payload?.battle_id || !payload?.campaign_id) {
        return;
      }
      const who = payload.user_label?.trim() || "A player";
      toast(
        payload.reason === "expired"
          ? `${who} didn't answer your battle invite in time.`
          : `${who} declined your battle invite.`,
        { id: `battle-declined-${payload.battle_id}-${payload.user_label ?? ""}` }
      );
      void invalidateOpenBattles(queryClient, payload.campaign_id);
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
      void invalidateOpenBattles(queryClient, payload.campaign_id);
      // Offer the battle instead of navigating away from whatever the user is doing (BUG-26).
      const battlePath = `/campaigns/${payload.campaign_id}/battles/${payload.battle_id}`;
      if (!location.pathname.startsWith(`${battlePath}/`)) {
        toast(`Prebattle is open for ${payload.title?.trim() || `Battle #${payload.battle_id}`}`, {
          id: `battle-prebattle-${payload.battle_id}`,
          duration: ACTIONABLE_TOAST_MS,
          action: { label: "Go", onClick: () => navigate(`${battlePath}/prebattle`) },
        });
      }
    }
  });
}
