import { useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// components
import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { ConfirmDialog } from "@components/confirm-dialog";
import { PageHeader } from "@components/page-header";

// components
import BattleActionPanel from "../components/overview/BattleActionPanel";
import BattleHistoryTable from "../components/overview/BattleHistoryTable";
import OnesToWatchRow from "../components/overview/OnesToWatchRow";
import PivotalMomentsTable from "../components/overview/PivotalMomentsTable";
import RosterTable from "../components/overview/RosterTable";
import TradeOverviewTable from "../components/overview/TradeOverviewTable";

// hooks
import { useCampaignOverview } from "../hooks/useCampaignOverview";

// types
import type { CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

export default function CampaignOverview() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [mobileExpandedSections, setMobileExpandedSections] = useState({
    roster: true,
    battleHistory: true,
    pivotalMoments: true,
    trades: true,
  });

  const campaignId = Number(id);

  const {
    players,
    isLoading,
    error,
    tradeRequests,
    tradeError,
    isTradesLoading,
    battleHistory,
    battleHistoryError,
    isBattleHistoryLoading,
    pivotalMoments,
    pivotalMomentsError,
    isPivotalMomentsLoading,
    topKillers,
    topKillersError,
    isTopKillersLoading,
    expandedPlayers,
    heroSnapshots,
    snapshotLoading,
    snapshotErrors,
    togglePlayer,
    canStartCampaign,
    isUnderway,
    isStartOpen,
    setIsStartOpen,
    isStarting,
    startError,
    handleStartCampaign,
  } = useCampaignOverview({ campaignId, campaign });

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  }

  const toggleMobileSection = (
    key: "roster" | "battleHistory" | "pivotalMoments" | "trades"
  ) => {
    setMobileExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="min-h-0 space-y-6">
      <OverviewHeader campaign={campaign} />
      <CardBackground
        disableBackground={isMobile}
        className={
          isMobile
            ? "space-y-4 p-2 rounded-none border-x-0"
            : "space-y-4 p-3 sm:space-y-6 sm:p-6"
        }
      >
        {canStartCampaign && !isUnderway ? (
          <div className="flex justify-center px-2 sm:px-0">
            <Button variant="secondary" onClick={() => setIsStartOpen(true)}>
              Start campaign
            </Button>
            <ConfirmDialog
              open={isStartOpen}
              onOpenChange={(nextOpen) => {
                setIsStartOpen(nextOpen);
                if (!nextOpen) {
                  // startError is managed by hook
                }
              }}
              description={
                <div className="space-y-2">
                  <p>Start the campaign now? This will lock in the roster.</p>
                  {startError ? <p className="text-sm text-red-600">{startError}</p> : null}
                </div>
              }
              confirmText={isStarting ? "Starting..." : "Confirm start"}
              confirmVariant="secondary"
              confirmDisabled={isStarting}
              isConfirming={isStarting}
              onConfirm={handleStartCampaign}
              onCancel={() => setIsStartOpen(false)}
            />
          </div>
        ) : null}
        {isUnderway ? <BattleActionPanel campaignId={campaign.id} players={players} campaignStarted={isUnderway} /> : null}
        <OnesToWatchRow
          isLoading={isTopKillersLoading}
          error={topKillersError}
          topKiller={topKillers[0] ?? null}
        />
        <div className="grid gap-4 min-[1200px]:grid-cols-2">
          <RosterTable
            campaignId={campaign.id}
            playerCount={campaign.player_count}
            maxPlayers={campaign.max_players}
            isMobile={isMobile}
            mobileExpanded={mobileExpandedSections.roster}
            onToggleMobileExpanded={() => toggleMobileSection("roster")}
            isLoading={isLoading}
            error={error}
            players={players}
            expandedPlayers={expandedPlayers}
            onTogglePlayer={togglePlayer}
            heroSnapshots={heroSnapshots}
            snapshotLoading={snapshotLoading}
            snapshotErrors={snapshotErrors}
          />
          <BattleHistoryTable
            isLoading={isBattleHistoryLoading}
            error={battleHistoryError}
            battles={battleHistory}
            players={players}
            isMobile={isMobile}
            mobileExpanded={mobileExpandedSections.battleHistory}
            onToggleMobileExpanded={() => toggleMobileSection("battleHistory")}
          />
          <PivotalMomentsTable
            isMobile={isMobile}
            mobileExpanded={mobileExpandedSections.pivotalMoments}
            onToggleMobileExpanded={() => toggleMobileSection("pivotalMoments")}
            isLoading={isPivotalMomentsLoading}
            error={pivotalMomentsError}
            moments={pivotalMoments}
          />
          <TradeOverviewTable
            isMobile={isMobile}
            mobileExpanded={mobileExpandedSections.trades}
            onToggleMobileExpanded={() => toggleMobileSection("trades")}
            isLoading={isTradesLoading}
            error={tradeError}
            trades={tradeRequests}
          />
        </div>
      </CardBackground>
    </div>
  );
}

type OverviewHeaderProps = {
  campaign: CampaignSummary;
};

function OverviewHeader({ campaign }: OverviewHeaderProps) {
  return (
    <PageHeader
      title={campaign.name}
    />
  );
}
