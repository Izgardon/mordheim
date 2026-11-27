import type { CampaignSummary } from "../../types/campaign-types";
import CampaignFeatures from "./CampaignFeatures";
import ExplorationSection from "./ExplorationSection";
import LevelUps from "./LevelUps";
import PlotsSection from "./PlotsSection";
import ResourceSection from "./ResourceSection";
import { SettingsCard } from "./settings-ui";
import WarbandLimits from "./WarbandLimits";

/**
 * Settings → Rules (`edit_settings`): what the campaign plays by, each part folded under what it
 * holds now (William, 27 Nov 2026: "the checkboxes for campaigns, blood pacts etc can all be
 * hidden til needing to be viewed"). The exploration chart is one dropdown, so it stays open; the
 * plots show while Plots and CP is on.
 */
export default function RulesCard({ campaign }: { campaign: CampaignSummary }) {
  return (
    <SettingsCard title="Rules">
      <div className="flex flex-col">
        <CampaignFeatures campaign={campaign} />
        <WarbandLimits campaign={campaign} />
        <div className="border-t border-line py-3">
          <ExplorationSection campaign={campaign} />
        </div>
        <ResourceSection campaign={campaign} />
        <LevelUps campaign={campaign} />
        {campaign.enable_campaign_points ? <PlotsSection campaign={campaign} /> : null}
      </div>
    </SettingsCard>
  );
}
