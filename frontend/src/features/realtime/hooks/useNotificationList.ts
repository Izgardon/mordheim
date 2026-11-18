import { useCallback } from "react";

import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  toBountyClaimNotification,
  type BountyClaimPayload,
} from "@/features/bounties/notifications";
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
import { notificationFromApi } from "../utils/notification-mappers";

/** Puts a `GET /notifications/` list into the bell (`replace` drops what isn't listed). */
export function useApplyNotificationList() {
  const {
    addTradeRequestNotification,
    clearTradeRequestNotifications,
    addBattleInviteNotification,
    clearBattleInviteNotifications,
    addBattleResultRequestNotification,
    clearBattleResultRequestNotifications,
    addBountyClaimNotification,
    clearBountyClaimNotifications,
    setCurrentBattleSession,
  } = useAppStore();

  return useCallback(
    (notifications: AppNotification[], { replace }: { replace: boolean }) => {
      if (replace) {
        clearTradeRequestNotifications();
        clearBattleInviteNotifications();
        clearBattleResultRequestNotifications();
        clearBountyClaimNotifications();
      }
      for (const n of notifications) {
        if (n.notification_type === "bounty_claim") {
          const claim = toBountyClaimNotification(n.payload as BountyClaimPayload, n.id);
          if (claim) addBountyClaimNotification(claim);
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
      addBountyClaimNotification,
      clearBountyClaimNotifications,
      addBattleResultRequestNotification,
      addTradeRequestNotification,
      clearBattleInviteNotifications,
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
