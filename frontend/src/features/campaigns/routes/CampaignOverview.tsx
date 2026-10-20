import { useState } from "react";

import "../styles/campaigns.css";

// routing
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// components
import { Button } from "@components/button";
import { PageHeader } from "@components/page-header";
import TabbedCard from "@components/tabbed-card";
import BattleActionPanel from "../components/overview/BattleActionPanel";
import BulletinBoardTab from "../components/overview/BulletinBoardTab";
import OverviewSections, {
  ALL_SECTIONS_OPEN,
  type OverviewSection,
} from "../components/overview/OverviewSections";
import StartCampaignDialog from "../components/overview/StartCampaignDialog";
import StuckBattlesBanner from "../components/overview/StuckBattlesBanner";

// hooks
import { campaignCapabilities, isArchived } from "../capabilities";
import { useCampaignOverview } from "../hooks/useCampaignOverview";

// types
import type { CampaignLayoutContext } from "./CampaignLayout";

type OverviewTab = "overview" | "bulletin";

const overviewTabs = [{ id: "overview" as const, label: "Overview" }] as const;

const resolveOverviewTab = (value: string | null): OverviewTab | null =>
  value === "bulletin" ? "bulletin" : value === "overview" ? "overview" : null;

export default function CampaignOverview() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const activeTab = resolveOverviewTab(searchParams.get("tab")) ?? "overview";
  const [mobileExpandedSections, setMobileExpandedSections] = useState(ALL_SECTIONS_OPEN);
  const campaignId = Number(id);
  const overview = useCampaignOverview({ campaignId, campaign, activeTab });

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  }

  const toggleMobileSection = (key: OverviewSection) =>
    setMobileExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

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

  const showStart = overview.canStartCampaign && !overview.isUnderway;
  const overviewTabContent =
    activeTab === "overview" ? (
      <OverviewSections
        campaign={campaign}
        overview={overview}
        isMobile={isMobile}
        expanded={mobileExpandedSections}
        onToggle={toggleMobileSection}
      />
    ) : (
      <BulletinBoardTab
        isTopKillersLoading={overview.isTopKillersLoading}
        topKillersError={overview.topKillersError}
        topKillers={overview.topKillers}
        isBulletinLoading={overview.isBulletinLoading}
        bulletinError={overview.bulletinError}
        bulletinActionError={overview.bulletinActionError}
        bulletinEntries={overview.bulletinEntries}
        isCreatingBulletinEntry={overview.isCreatingBulletinEntry}
        deletingBulletinEntryIds={overview.deletingBulletinEntryIds}
        onCreateBulletinEntry={overview.handleCreateBulletinEntry}
        onDeleteBulletinEntry={overview.handleDeleteBulletinEntry}
      />
    );

  return (
    <div className="min-h-0 space-y-6">
      <PageHeader
        title={campaign.name}
        tabs={overviewTabs}
        activeTab={activeTab === "bulletin" ? "overview" : activeTab}
        onTabChange={handleTabChange}
      />
      <div className="space-y-4 px-2 sm:space-y-6 sm:px-0">
        {showStart ? (
          <StartCampaignDialog
            open={overview.isStartOpen}
            onOpenChange={overview.setIsStartOpen}
            isStarting={overview.isStarting}
            error={overview.startError}
            onConfirm={overview.handleStartCampaign}
          />
        ) : null}
        <StuckBattlesBanner
          campaignId={campaign.id}
          enabled={campaignCapabilities(campaign).manage_battles}
        />
        <div className="pt-3 sm:pt-0">
          {/* Before the start too: Start battle is greyed out but clickable (decision 3). */}
          <BattleActionPanel
            campaignId={campaign.id}
            players={overview.players}
            campaignStarted={overview.isUnderway}
            readOnly={isArchived(campaign)}
            leadingAction={
              showStart ? (
                <Button variant="secondary" size="sm" onClick={() => overview.setIsStartOpen(true)}>
                  Start campaign
                </Button>
              ) : null
            }
          />
        </div>
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
