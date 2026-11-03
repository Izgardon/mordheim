import type { YourOpenBattle } from "@/features/battles/utils/open-battles";

import type { CampaignSummary } from "../../types/campaign-types";
import ArchivedBanner from "./ArchivedBanner";
import NoWarbandBanner from "./NoWarbandBanner";
import RejoinBanner from "./RejoinBanner";

/**
 * The campaign's notices in the page's flow, heading it. On a phone every page's: the archived
 * notice, then your battle (not on its own screens, nor on the overview, whose Start battle reads
 * Rejoin and whose Between battles stays first), else Raise your warband. On the web they live in
 * the bar (`CampaignBar`), but for the overview's archived notice and Raise your warband, since its
 * bar holds Between battles.
 */
export default function CampaignPageNotices({
  campaign,
  pathname,
  battles,
  isMobile,
  isOverview,
  isBattleRoute,
}: {
  campaign: CampaignSummary;
  pathname: string;
  battles: YourOpenBattle[];
  isMobile: boolean;
  isOverview: boolean;
  isBattleRoute: boolean;
}) {
  if (!isMobile && !isOverview) {
    return null;
  }
  return (
    <>
      <ArchivedBanner campaign={campaign} />
      {!isBattleRoute && !isOverview && battles.length ? (
        <RejoinBanner campaignId={campaign.id} battles={battles} />
      ) : (
        <NoWarbandBanner campaign={campaign} pathname={pathname} />
      )}
    </>
  );
}
