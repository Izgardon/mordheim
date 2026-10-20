import { useCallback } from "react";

import { useAuth } from "@/features/auth/hooks/use-auth";
import type {
  BattleInviteNotification,
  BattleResultRequestNotification,
} from "@/features/battles/types/battle-types";
import {
  listNotifications,
  type AppNotification,
} from "@/features/notifications/api/notifications-api";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import { useAppStore } from "@/stores/app-store";
import {
  notificationFromApi,
  toBattleNudgeNotification,
  type BattleNotificationPayload,
} from "../utils/notification-mappers";

/** Puts a `GET /notifications/` list into the bell (`replace` drops what isn't listed). */
export function useApplyNotificationList() {
  const {
    addTradeRequestNotification,
    clearTradeRequestNotifications,
    addBattleInviteNotification,
    clearBattleInviteNotifications,
    addBattleResultRequestNotification,
    clearBattleResultRequestNotifications,
    addBattleNudgeNotification,
    clearBattleNudgeNotifications,
    setCurrentBattleSession,
  } = useAppStore();

  return useCallback(
    (notifications: AppNotification[], { replace }: { replace: boolean }) => {
      if (replace) {
        clearTradeRequestNotifications();
        clearBattleInviteNotifications();
        clearBattleResultRequestNotifications();
        clearBattleNudgeNotifications();
      }
      for (const n of notifications) {
        if (n.notification_type === "battle_nudge") {
          // A nudge waiting since you were away (BATL-NEW-08).
          const nudge = toBattleNudgeNotification(n.payload as BattleNotificationPayload, n.id);
          if (nudge) addBattleNudgeNotification(nudge);
          continue;
        }
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
    },
    [
      addBattleInviteNotification,
      addBattleNudgeNotification,
      addBattleResultRequestNotification,
      addTradeRequestNotification,
      clearBattleInviteNotifications,
      clearBattleNudgeNotifications,
      clearBattleResultRequestNotifications,
      clearTradeRequestNotifications,
      setCurrentBattleSession,
    ]
  );
}

/**
 * Reads the bell's list again and replaces it: after a reconnect, a removal, or Clear all, which
 * keeps what still needs an answer (CAMP-TWEAK-10). Resolves when the bell shows it.
 */
export function useReloadNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const applyNotificationList = useApplyNotificationList();
  return useCallback(() => {
    if (!userId) {
      return Promise.resolve();
    }
    return listNotifications()
      .then((notifications) => applyNotificationList(notifications, { replace: true }))
      .catch(() => {});
  }, [applyNotificationList, userId]);
}
