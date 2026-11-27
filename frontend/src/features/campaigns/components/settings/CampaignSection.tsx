import { campaignCapabilities } from "../../capabilities";
import type { CampaignSummary } from "../../types/campaign-types";
import ArchiveSection from "./ArchiveSection";
import CampaignBasics from "./CampaignBasics";
import CampaignPresetCard from "./CampaignPresetCard";
import ContentInPlayCard from "./ContentInPlayCard";
import RulesCard from "./RulesCard";

/**
 * Settings → Campaign (`edit_settings`, the owner), in five parts (William, 27 Nov 2026: "too
 * long and awkward and poorly sectioned"): its name, the published campaign it plays and what that
 * sets, the content in play, the rules, and last the danger zone (William, 18 Nov 2026: "The
 * archive section can just be at the bottom of the campaign settings page for the owner only").
 * The long parts are folded until opened. An archived campaign keeps nothing but the last card:
 * every setting above it would be refused.
 */
export default function CampaignSection({ campaign }: { campaign: CampaignSummary }) {
  const capabilities = campaignCapabilities(campaign);
  return (
    <>
      {capabilities.edit_settings ? (
        <>
          <CampaignBasics campaign={campaign} />
          <CampaignPresetCard campaign={campaign} />
          <ContentInPlayCard campaign={campaign} />
          <RulesCard campaign={campaign} />
        </>
      ) : null}
      {capabilities.archive || capabilities.restore || capabilities.delete ? (
        <ArchiveSection campaign={campaign} capabilities={capabilities} />
      ) : null}
    </>
  );
}
