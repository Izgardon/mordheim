// hooks
import { useBulletinBoard } from "./overview/useBulletinBoard";
import { useOverviewLists } from "./overview/useOverviewLists";
import { useRosterExpansion } from "./overview/useRosterExpansion";
import { useStartCampaign } from "./overview/useStartCampaign";

// types
import type { CampaignSummary } from "../types/campaign-types";

type UseCampaignOverviewParams = {
  campaignId: number;
  campaign: CampaignSummary | null;
  /** The bulletin tab's data (bulletin, top killers) loads only while that tab is open. */
  activeTab: "overview" | "bulletin";
};

/**
 * The overview page's controller: each section's cached queries and actions (IMP-66), so a
 * revisit within the stale time reads nothing again.
 */
export function useCampaignOverview({
  campaignId,
  campaign,
  activeTab,
}: UseCampaignOverviewParams) {
  return {
    ...useOverviewLists(campaignId),
    ...useBulletinBoard(campaignId, activeTab === "bulletin"),
    ...useRosterExpansion(campaignId),
    ...useStartCampaign(campaign),
  };
}
