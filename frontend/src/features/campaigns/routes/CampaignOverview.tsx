import { useState } from "react";

import "../styles/campaigns.css";

// routing
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// components
import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { PageHeader } from "@components/page-header";
import TabbedCard from "@components/tabbed-card";

// components
import BattleActionPanel from "../components/overview/BattleActionPanel";
import BattleHistoryTable from "../components/overview/BattleHistoryTable";
import BulletinBoardTab from "../components/overview/BulletinBoardTab";
import PivotalMomentsTable from "../components/overview/PivotalMomentsTable";
import RosterTable from "../components/overview/RosterTable";
import TradeOverviewTable from "../components/overview/TradeOverviewTable";

// hooks
import { useCampaignOverview } from "../hooks/useCampaignOverview";

// types
import type { CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

type OverviewTab = "overview" | "bulletin";

const overviewTabs = [
  { id: "overview" as const, label: "Overview" },
] as const;

const resolveOverviewTab = (value: string | null): OverviewTab | null =>
  value === "bulletin" ? "bulletin" : value === "overview" ? "overview" : null;

export default function CampaignOverview() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const activeTab = resolveOverviewTab(searchParams.get("tab")) ?? "overview";
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
    bulletinEntries,
    bulletinError,
    isBulletinLoading,
    bulletinActionError,
    isCreatingBulletinEntry,
    deletingBulletinEntryIds,
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
    handleCreateBulletinEntry,
    handleDeleteBulletinEntry,
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

  const handleTabChange = (tabId: string) => {
    const nextTab = resolveOverviewTab(tabId) ?? "overview";
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "overview") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const overviewTabContent =
    activeTab === "overview" ? (
      <div className="grid gap-8">
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
    ) : (
      <BulletinBoardTab
        isTopKillersLoading={isTopKillersLoading}
        topKillersError={topKillersError}
        topKillers={topKillers}
        isBulletinLoading={isBulletinLoading}
        bulletinError={bulletinError}
        bulletinActionError={bulletinActionError}
        bulletinEntries={bulletinEntries}
        isCreatingBulletinEntry={isCreatingBulletinEntry}
        deletingBulletinEntryIds={deletingBulletinEntryIds}
        onCreateBulletinEntry={handleCreateBulletinEntry}
        onDeleteBulletinEntry={handleDeleteBulletinEntry}
      />
    );

  return (
    <div className="min-h-0 space-y-6">
      <OverviewHeader
        campaign={campaign}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      <div className="space-y-4 px-2 sm:space-y-6 sm:px-0">
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
                  <p className="text-sm text-muted-foreground">
                    Before starting, make sure all Campaign Settings locations are set for items,
                    all House Rules are added, and any spell lists and skill lists are ready.
                  </p>
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
        {isUnderway ? (
          <div className="pt-3 sm:pt-0">
            <BattleActionPanel
              campaignId={campaign.id}
              players={players}
              campaignStarted={isUnderway}
            />
          </div>
        ) : null}
        {isMobile ? (
          <TabbedCard
            tabs={overviewTabs}
            activeTab="overview"
            onTabChange={() => handleTabChange("overview")}
            mobileTabsShowDivider
            className="pb-6"
            contentClassName="space-y-4 pt-2"
          >
            {overviewTabContent}
          </TabbedCard>
        ) : (
          overviewTabContent
        )}
      </div>
    </div>
  );
}

type OverviewHeaderProps = {
  campaign: CampaignSummary;
  activeTab: OverviewTab;
  onTabChange: (tabId: string) => void;
};

function OverviewHeader({
  campaign,
  activeTab,
  onTabChange,
}: OverviewHeaderProps) {
  return (
    <PageHeader
      title={campaign.name}
      tabs={overviewTabs}
      activeTab={activeTab === "bulletin" ? "overview" : activeTab}
      onTabChange={onTabChange}
    />
  );
}
