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

/** The campaign's name over the page's title, when nothing more urgent fills the bar. */
function BarTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-px">
      <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        {kicker}
      </span>
      <span className="truncate font-display text-xl font-semibold leading-tight text-head">
        {title}
      </span>
    </span>
  );
}

/**
 * The web bar on a campaign's pages, the battle screens included: Campaigns and Log out, then the
 * main part `campaignBarContent` picks. The overview's players are the overview's own query, read
 * here only there.
 */
export default function CampaignBar({
  campaign,
  pathname,
  title,
  battles,
  isOverview,
}: {
  campaign: CampaignSummary;
  pathname: string;
  /** The page's title, for when nothing more urgent fills the bar. */
  title: string;
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
  const tone = content === "readiness" ? "band" : content === "title" ? "plain" : "accent";

  return (
    <WebTopBar tone={tone}>
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
      {content === "title" ? <BarTitle kicker={campaign.name} title={title} /> : null}
    </WebTopBar>
  );
}
