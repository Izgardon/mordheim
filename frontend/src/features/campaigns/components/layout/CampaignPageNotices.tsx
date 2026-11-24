import type { CampaignSummary } from "../../types/campaign-types";
import ArchivedBanner from "./ArchivedBanner";
import NoWarbandBanner from "./NoWarbandBanner";

/**
 * The campaign's notices in the page's flow, heading it. On a phone every page's: the archived
 * notice, then Raise your warband; your battle is the bottom nav's glowing Battle instead
 * (William, 24 Nov 2026: "instead of banner up top prompting you to rejoin battle can the battle
 * nav icon be glowing and highlighted"). On the web they live in the bar (`CampaignBar`), but for
 * the overview's archived notice and Raise your warband, since its bar holds Between battles.
 */
export default function CampaignPageNotices({
  campaign,
  pathname,
  isMobile,
  isOverview,
}: {
  campaign: CampaignSummary;
  pathname: string;
  isMobile: boolean;
  isOverview: boolean;
}) {
  if (!isMobile && !isOverview) {
    return null;
  }
  return (
    <>
      <ArchivedBanner campaign={campaign} />
      <NoWarbandBanner campaign={campaign} pathname={pathname} />
    </>
  );
}
