import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dropFromCampaignList } from "@/features/campaigns/hooks/useCampaignList";
import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";

import type { NotificationMessage } from "@/lib/realtime";

/** Long enough to read; the warband is kept, so nothing needs an answer. */
const MEMBERSHIP_TOAST_MS = 12_000;
const WARBAND_KEPT = "Your warband is kept and comes back if you rejoin.";

export type MembershipNotificationContext = {
  queryClient: QueryClient;
  location: { pathname: string };
  navigate: (path: string) => void;
  /** Reloads the bell: the server resolved the member's notifications for the campaign. */
  reloadNotifications: () => void;
  currentBattleCampaignId: number | null;
  clearCurrentBattleSession: () => void;
};

type MembershipPayload = {
  campaign_id?: number;
  campaign_name?: string;
  removed_by?: string;
  change?: "role" | "permissions";
  role?: string;
};

/** The toast a membership change shows: who did what, and what it means for you. */
const membershipToast = (type: string, campaignName: string, payload: MembershipPayload) => {
  if (type === "membership_left") {
    return { id: "membership-left", title: `You left ${campaignName}.`, description: WARBAND_KEPT };
  }
  if (type === "campaign_deleted") {
    return { id: "campaign-deleted", title: `${campaignName} was deleted by its owner.` };
  }
  if (type === "membership_changed") {
    const title =
      payload.change === "role"
        ? `Your role in ${campaignName} changed to ${payload.role ?? "player"}.`
        : `Your permissions in ${campaignName} changed.`;
    return { id: "membership-changed", title };
  }
  const by = payload.removed_by?.trim();
  return {
    id: "membership-removed",
    title: `You were removed from ${campaignName}${by ? ` by ${by}` : ""}.`,
    description: WARBAND_KEPT,
  };
};

/**
 * You are no longer in a campaign (removed, decision 1, or you left, CAMP-NEW-03): taken off its
 * pages and out of your campaigns list, and what was cached for it is marked stale without being
 * read (you can't read it now), so rejoining later reads it afresh. A campaign deleted for good
 * (`forGood`, CAMP-TWEAK-04) is forgotten instead.
 */
export function leaveCampaignPages(
  ctx: MembershipNotificationContext,
  campaignId: number,
  { forGood = false } = {}
) {
  const campaignPath = `/campaigns/${campaignId}`;
  const { pathname } = ctx.location;
  if (pathname === campaignPath || pathname.startsWith(`${campaignPath}/`)) {
    ctx.navigate("/campaigns");
  }
  if (ctx.currentBattleCampaignId === campaignId) {
    ctx.clearCurrentBattleSession();
  }
  dropFromCampaignList(ctx.queryClient, campaignId);
  if (forGood) {
    ctx.queryClient.removeQueries({ queryKey: queryKeys.campaign.all(campaignId) });
    return;
  }
  void ctx.queryClient.invalidateQueries({
    queryKey: queryKeys.campaign.all(campaignId),
    refetchType: "none",
  });
}

/**
 * Membership events on your notification channel: `membership_removed`, `membership_left`,
 * `membership_changed` (a role or grant change, CAMP-NEW-07, which re-reads the campaign for its
 * capabilities) and `campaign_deleted` (its owner deleted it for good, CAMP-TWEAK-04). Returns
 * whether it handled the message.
 */
export function handleMembershipNotification(
  message: NotificationMessage,
  ctx: MembershipNotificationContext
) {
  const { type } = message;
  if (
    type !== "membership_removed" &&
    type !== "membership_left" &&
    type !== "membership_changed" &&
    type !== "campaign_deleted"
  ) {
    return false;
  }
  const payload = (message.payload ?? {}) as MembershipPayload;
  const campaignId = Number(payload.campaign_id);
  if (!isCampaignId(campaignId)) {
    return true;
  }

  const campaignName = payload.campaign_name?.trim() || "a campaign";
  const shown = membershipToast(type, campaignName, payload);
  toast(shown.title, {
    id: `${shown.id}-${campaignId}`,
    description: shown.description,
    duration: MEMBERSHIP_TOAST_MS,
  });

  if (type === "membership_changed") {
    void ctx.queryClient.invalidateQueries({ queryKey: queryKeys.campaign.detail(campaignId) });
    return true;
  }
  leaveCampaignPages(ctx, campaignId, { forGood: type === "campaign_deleted" });
  ctx.reloadNotifications();
  return true;
}
