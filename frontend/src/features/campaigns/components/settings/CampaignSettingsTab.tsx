// components
import ActiveBattlesSection from "./ActiveBattlesSection";
import ArchiveCampaignCard from "./ArchiveCampaignCard";
import ArchivedCampaignCard from "./ArchivedCampaignCard";
import CampaignControlCard from "./CampaignControlCard";
import CampaignLevelUpSettingsCard from "./CampaignLevelUpSettingsCard";
import MembersSection from "./MembersSection";

// hooks
import { useCampaignLifecycle } from "../../hooks/settings/useCampaignLifecycle";

// types
import type { CampaignCapabilities } from "../../capabilities";
import type { CampaignSummary } from "../../types/campaign-types";

type CampaignSettingsTabProps = {
  campaign: CampaignSummary;
  capabilities: CampaignCapabilities;
};

/** Settings → Campaign: one card per capability the viewer holds (design 0.29). */
export default function CampaignSettingsTab({ campaign, capabilities }: CampaignSettingsTabProps) {
  const lifecycle = useCampaignLifecycle(campaign);
  return (
    <div className="space-y-8">
      {capabilities.view_members ? <MembersSection campaign={campaign} /> : null}
      {capabilities.manage_battles ? <ActiveBattlesSection campaignId={campaign.id} /> : null}
      {capabilities.edit_settings ? <CampaignControlCard campaign={campaign} /> : null}
      {capabilities.edit_settings ? <CampaignLevelUpSettingsCard campaign={campaign} /> : null}
      {capabilities.archive ? (
        <ArchiveCampaignCard campaign={campaign} lifecycle={lifecycle} />
      ) : null}
      {capabilities.restore || capabilities.delete ? (
        <ArchivedCampaignCard
          campaign={campaign}
          capabilities={capabilities}
          lifecycle={lifecycle}
        />
      ) : null}
    </div>
  );
}
