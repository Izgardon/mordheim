import { useEffect, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import TabbedCard from "@components/tabbed-card";
import { PageHeader } from "@components/page-header";
import CampaignSettingsTab from "../components/settings/CampaignSettingsTab";
import JoinCodeBadge from "../components/settings/JoinCodeBadge";
import PersonalSettingsTab from "../components/settings/PersonalSettingsTab";

// api
import { useCampaignActiveBattles, useCampaignMembers } from "../api/campaign-queries";
import { usePermissionCatalogue, useSetCampaign } from "../hooks/useCampaignQuery";

// other
import { campaignCapabilities, hasCampaignSettings } from "../capabilities";

// types
import type { CampaignLayoutContext } from "./CampaignLayout";

type SettingsTabId = "personal" | "campaign";

const SETTINGS_TABS = [
  { id: "personal" as const, label: "Personal" },
  { id: "campaign" as const, label: "Campaign" },
];

export default function CampaignSettings() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);
  const setCampaign = useSetCampaign(campaignId);
  const capabilities = campaignCapabilities(campaign);
  // A player granted manage_battles gets the Campaign tab for Active Battles alone (BATL-NEW-03).
  const hasCampaignTab = hasCampaignSettings(capabilities);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("personal");

  // The Campaign tab's lists load as the page opens, on either tab; its cards share them.
  useCampaignMembers(campaignId, { enabled: capabilities.view_members });
  useCampaignActiveBattles(campaignId, { enabled: capabilities.manage_battles });
  usePermissionCatalogue(campaignId, { enabled: capabilities.grant_permissions });

  useEffect(() => {
    if (!hasCampaignTab && activeTab !== "personal") {
      setActiveTab("personal");
    }
  }, [activeTab, hasCampaignTab]);

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of that campaign.</p>;
  }

  if (Number.isNaN(campaignId)) {
    return <p className="text-sm text-red-600">Invalid campaign id.</p>;
  }

  const joinCode = (compact: boolean) =>
    campaign.join_code ? (
      <JoinCodeBadge
        campaign={campaign}
        canRegenerate={capabilities.regenerate_join_code}
        onRegenerated={setCampaign}
        compact={compact}
      />
    ) : undefined;

  const personalTab = <PersonalSettingsTab campaign={campaign} capabilities={capabilities} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle={campaign.name}
        tabs={hasCampaignTab ? SETTINGS_TABS : undefined}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as SettingsTabId)}
        rightSlot={joinCode(false)}
      />

      {hasCampaignTab ? (
        <div className="space-y-4">
          <TabbedCard
            tabs={SETTINGS_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabsClassName="hidden"
            headerClassName="hidden"
            className="px-2 pb-6 sm:px-0"
            contentClassName="pt-4 sm:pt-0"
            mobileRight={joinCode(true)}
          >
            {activeTab === "personal" ? (
              personalTab
            ) : (
              <CampaignSettingsTab campaign={campaign} capabilities={capabilities} />
            )}
          </TabbedCard>
        </div>
      ) : (
        personalTab
      )}
    </div>
  );
}
