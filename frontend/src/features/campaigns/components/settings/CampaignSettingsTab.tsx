// components
import ActiveBattlesSection from "./ActiveBattlesSection";
import CampaignControlCard from "./CampaignControlCard";
import CampaignLevelUpSettingsCard from "./CampaignLevelUpSettingsCard";
import DeleteCampaignSection from "./DeleteCampaignSection";
import MembersSection from "./MembersSection";

// types
import type { CampaignCapabilities } from "../../capabilities";
import type { CampaignSummary } from "../../types/campaign-types";

type CampaignSettingsTabProps = {
  campaign: CampaignSummary;
  capabilities: CampaignCapabilities;
};

/** Settings → Campaign: one card per capability the viewer holds (design 0.29). */
export default function CampaignSettingsTab({ campaign, capabilities }: CampaignSettingsTabProps) {
  return (
    <div className="space-y-8">
      {capabilities.view_members ? <MembersSection campaign={campaign} /> : null}
      {capabilities.manage_battles ? <ActiveBattlesSection campaignId={campaign.id} /> : null}
      {capabilities.edit_settings ? <CampaignControlCard campaign={campaign} /> : null}
      {capabilities.edit_settings ? <CampaignLevelUpSettingsCard campaign={campaign} /> : null}
      {capabilities.delete ? <DeleteCampaignSection campaignId={campaign.id} /> : null}
    </div>
  );
}
