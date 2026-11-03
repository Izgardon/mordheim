import { useAuth } from "@/features/auth/hooks/use-auth";
import type { YourOpenBattle } from "@/features/battles/utils/open-battles";
import WebTopBar from "@/layouts/shell/WebTopBar";

import { useCampaignPlayers } from "../../api/campaign-queries";
import { isArchived } from "../../capabilities";
import type { CampaignSummary } from "../../types/campaign-types";
import { withWarbands } from "../overview/overview-data";
import { ReadinessBones } from "../overview/OverviewSkeleton";
import ReadinessBar from "../overview/ReadinessBar";
import ArchivedBanner from "./ArchivedBanner";
import { campaignBarContent } from "./campaign-bar";
import NoWarbandBanner, { useNeedsWarband } from "./NoWarbandBanner";
import RejoinBanner from "./RejoinBanner";

/**
 * The web bar on a campaign's pages, the battle screens included: the main part
 * `campaignBarContent` picks (or none), then Campaigns and Log out. The overview's players are the
 * overview's own query, read here only there.
 */
export default function CampaignBar({
  campaign,
  pathname,
  battles,
  isOverview,
}: {
  campaign: CampaignSummary;
  pathname: string;
  /** Your unfinished battles to show (none on a battle's own screens). */
  battles: YourOpenBattle[];
  isOverview: boolean;
}) {
  const { user } = useAuth();
  const raise = useNeedsWarband(campaign, pathname);
  const players = useCampaignPlayers(campaign.id, { enabled: isOverview });
  const content = campaignBarContent({
    isOverview,
    readiness: players.isPending || withWarbands(players.data ?? []).length > 0,
    battle: battles.length > 0,
    raise,
    archived: isArchived(campaign),
  });

  return (
    <WebTopBar>
      {content === "readiness" ? (
        players.data ? (
          <ReadinessBar players={players.data} userId={user?.id} isMobile={false} />
        ) : (
          <ReadinessBones />
        )
      ) : null}
      {content === "battle" ? (
        <RejoinBanner campaignId={campaign.id} battles={battles} look="bar" />
      ) : null}
      {content === "raise" ? (
        <NoWarbandBanner campaign={campaign} pathname={pathname} look="bar" />
      ) : null}
      {content === "archived" ? <ArchivedBanner campaign={campaign} look="bar" /> : null}
    </WebTopBar>
  );
}
