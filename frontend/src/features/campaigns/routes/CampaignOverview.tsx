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
import RosterTable from "../components/overview/RosterTable";
import TradeOverviewTable from "../components/overview/TradeOverviewTable";

// hooks
import { useCampaignOverview } from "../hooks/useCampaignOverview";

// types
import type { CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

const defaultTypeLabel = "Standard";

export default function CampaignOverview() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");

  const campaignId = Number(id);

  const {
    players,
    isLoading,
    error,
    tradeRequests,
    tradeError,
    isTradesLoading,
    expandedPlayers,
    heroSnapshots,
    snapshotLoading,
    snapshotErrors,
    togglePlayer,
    typeLabel,
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

  return (
    <div className="min-h-0 space-y-6">
      <OverviewHeader campaign={campaign} typeLabel={typeLabel} />
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
        <BattleActionPanel campaignId={campaign.id} players={players} campaignStarted={isUnderway} />
        <div className="grid gap-4 min-[1200px]:grid-cols-2">
          <RosterTable
            campaignId={campaign.id}
            playerCount={campaign.player_count}
            maxPlayers={campaign.max_players}
            isLoading={isLoading}
            error={error}
            players={players}
            expandedPlayers={expandedPlayers}
            onTogglePlayer={togglePlayer}
            heroSnapshots={heroSnapshots}
            snapshotLoading={snapshotLoading}
            snapshotErrors={snapshotErrors}
          />
          <TradeOverviewTable
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
  typeLabel: string;
};

function OverviewHeader({ campaign, typeLabel }: OverviewHeaderProps) {
  return (
    <PageHeader
      title={campaign.name}
      subtitle={typeLabel || defaultTypeLabel}
    />
  );
}
