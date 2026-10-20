import BattleHistorySection from "./BattleHistorySection";
import PivotalMomentsTable from "./PivotalMomentsTable";
import RosterTable from "./RosterTable";
import TradeOverviewTable from "./TradeOverviewTable";

import { campaignCapabilities } from "../../capabilities";

import type { useCampaignOverview } from "../../hooks/useCampaignOverview";
import type { CampaignSummary } from "../../types/campaign-types";

export type OverviewSection = "roster" | "battleHistory" | "pivotalMoments" | "trades";

/** Which sections are unfolded on phones (all, to start with). */
export const ALL_SECTIONS_OPEN: Record<OverviewSection, boolean> = {
  roster: true,
  battleHistory: true,
  pivotalMoments: true,
  trades: true,
};

type OverviewSectionsProps = {
  campaign: CampaignSummary;
  overview: ReturnType<typeof useCampaignOverview>;
  isMobile: boolean;
  expanded: Record<OverviewSection, boolean>;
  onToggle: (section: OverviewSection) => void;
};

/** The Overview tab: the roster, battle history, pivotal moments and trades (each folds on phones). */
export default function OverviewSections({
  campaign,
  overview,
  isMobile,
  expanded,
  onToggle: toggle,
}: OverviewSectionsProps) {
  return (
    <div className="grid gap-8">
      <RosterTable
        campaignId={campaign.id}
        playerCount={campaign.player_count}
        maxPlayers={campaign.max_players}
        isMobile={isMobile}
        mobileExpanded={expanded.roster}
        onToggleMobileExpanded={() => toggle("roster")}
        isLoading={overview.isLoading}
        error={overview.error}
        players={overview.players}
        expandedPlayers={overview.expandedPlayers}
        onTogglePlayer={overview.togglePlayer}
        heroSnapshots={overview.heroSnapshots}
        snapshotLoading={overview.snapshotLoading}
        snapshotErrors={overview.snapshotErrors}
      />
      <BattleHistorySection
        campaignId={campaign.id}
        canEditRecords={campaignCapabilities(campaign).manage_battles}
        onRecordSaved={overview.reloadBattleHistory}
        isLoading={overview.isBattleHistoryLoading}
        error={overview.battleHistoryError}
        battles={overview.battleHistory}
        players={overview.players}
        isMobile={isMobile}
        mobileExpanded={expanded.battleHistory}
        onToggleMobileExpanded={() => toggle("battleHistory")}
      />
      <PivotalMomentsTable
        isMobile={isMobile}
        mobileExpanded={expanded.pivotalMoments}
        onToggleMobileExpanded={() => toggle("pivotalMoments")}
        isLoading={overview.isPivotalMomentsLoading}
        error={overview.pivotalMomentsError}
        moments={overview.pivotalMoments}
      />
      <TradeOverviewTable
        isMobile={isMobile}
        mobileExpanded={expanded.trades}
        onToggleMobileExpanded={() => toggle("trades")}
        isLoading={overview.isTradesLoading}
        error={overview.tradeError}
        trades={overview.tradeRequests}
      />
    </div>
  );
}
