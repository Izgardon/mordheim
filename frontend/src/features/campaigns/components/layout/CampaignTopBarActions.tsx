import CampaignChatMenu from "@/features/realtime/components/CampaignChatMenu";
import CampaignDiceRollerMenu from "@/features/realtime/components/CampaignDiceRollerMenu";
import NotificationsMenu from "@/features/realtime/components/NotificationsMenu";
import { useNotifications } from "@/features/realtime/hooks/useNotifications";

/** The bell, wired to your notifications; it re-renders alone when they change. */
function CampaignNotificationsMenu() {
  const notifications = useNotifications();
  return (
    <NotificationsMenu
      tradeRequestNotifications={notifications.tradeRequestNotifications}
      battleInviteNotifications={notifications.battleInviteNotifications}
      battleResultRequestNotifications={notifications.battleResultRequestNotifications}
      onAcceptTrade={notifications.acceptTradeNotification}
      onDeclineTrade={notifications.declineTradeNotification}
      onAcceptBattleInvite={notifications.acceptBattleInviteNotification}
      onDeclineBattleInvite={notifications.declineBattleInviteNotification}
      onAcceptBattleResultRequest={notifications.acceptBattleResultRequestNotification}
      onDeclineBattleResultRequest={notifications.declineBattleResultRequestNotification}
      battleNudgeNotifications={notifications.battleNudgeNotifications}
      onGoToNudge={notifications.goToBattleNudge}
      onDismissNudge={notifications.dismissBattleNudge}
      onClear={notifications.clearNotifications}
    />
  );
}

/**
 * The campaign top bar's tools, built once for both breakpoints: the dice roller, the campaign
 * chat and the bell.
 */
export default function CampaignTopBarActions({ campaignId }: { campaignId: number }) {
  return (
    <>
      <CampaignDiceRollerMenu />
      <CampaignChatMenu campaignId={campaignId} />
      <CampaignNotificationsMenu />
    </>
  );
}
