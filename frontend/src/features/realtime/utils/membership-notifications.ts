import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";

import type { NotificationMessage } from "@/lib/realtime";

/** Long enough to read; the warband is kept, so nothing needs an answer. */
const REMOVED_TOAST_MS = 12_000;

export type MembershipNotificationContext = {
  queryClient: QueryClient;
  location: { pathname: string };
  navigate: (path: string) => void;
  /** Reloads the bell: the server resolved the removed player's notifications for the campaign. */
  reloadNotifications: () => void;
  currentBattleCampaignId: number | null;
  clearCurrentBattleSession: () => void;
};

type MembershipRemovedPayload = {
  campaign_id?: number;
  campaign_name?: string;
  removed_by?: string;
};

/**
 * `membership_removed` (decision 1): an owner or admin removed you from a campaign. You're told,
 * taken off its pages, and what was cached for it is marked stale (not refetched, since you can no
 * longer read it), so rejoining later reads it afresh. Returns whether it handled the message.
 */
export function handleMembershipNotification(
  message: NotificationMessage,
  ctx: MembershipNotificationContext
) {
  if (message.type !== "membership_removed") {
    return false;
  }
  const payload = (message.payload ?? {}) as MembershipRemovedPayload;
  const campaignId = Number(payload.campaign_id);
  if (!isCampaignId(campaignId)) {
    return true;
  }

  const campaignName = payload.campaign_name?.trim() || "a campaign";
  const by = payload.removed_by?.trim();
  toast(`You were removed from ${campaignName}${by ? ` by ${by}` : ""}.`, {
    id: `membership-removed-${campaignId}`,
    description: "Your warband is kept and comes back if you rejoin.",
    duration: REMOVED_TOAST_MS,
  });

  const campaignPath = `/campaigns/${campaignId}`;
  const { pathname } = ctx.location;
  if (pathname === campaignPath || pathname.startsWith(`${campaignPath}/`)) {
    ctx.navigate("/campaigns");
  }
  if (ctx.currentBattleCampaignId === campaignId) {
    ctx.clearCurrentBattleSession();
  }
  void ctx.queryClient.invalidateQueries({
    queryKey: queryKeys.campaign.all(campaignId),
    refetchType: "none",
  });
  ctx.reloadNotifications();
  return true;
}
