import { CardBackground } from "@components/card-background";

import CampaignFeaturesField from "./CampaignFeaturesField";
import ItemSettingsField from "./ItemSettingsField";

import type { CampaignSummary } from "../../types/campaign-types";

/** Campaign Systems (`edit_settings`, the owner): shared pages and item settings. */
export default function CampaignControlCard({ campaign }: { campaign: CampaignSummary }) {
  return (
    <CardBackground className="space-y-2 p-3 bg-[rgba(12,9,6,0.92)] sm:space-y-2.5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Campaign Systems</h3>
      <CampaignFeaturesField campaign={campaign} />
      <ItemSettingsField campaign={campaign} />
    </CardBackground>
  );
}
