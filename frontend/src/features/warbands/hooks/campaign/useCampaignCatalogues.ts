import { useCampaignItems } from "./useCampaignItems";
import { useCampaignRaces } from "./useCampaignRaces";
import { useCampaignSkills } from "./useCampaignSkills";
import { useCampaignSpecial } from "./useCampaignSpecial";
import { useCampaignSpells } from "./useCampaignSpells";

/** The five catalogue lists the warband editor needs, each with its own loading and error state. */
export function useCampaignCatalogues(campaignId: number) {
  const params = { campaignId, hasCampaignId: !Number.isNaN(campaignId) };

  return {
    ...useCampaignItems(params),
    ...useCampaignSkills(params),
    ...useCampaignSpells(params),
    ...useCampaignSpecial(params),
    ...useCampaignRaces(params),
  };
}
