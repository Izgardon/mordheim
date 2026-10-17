import { useCatalogue } from "@/lib/catalogue-queries";

type UseCampaignSpellsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignSpells({
  campaignId,
  hasCampaignId,
  enabled = true,
}: UseCampaignSpellsParams) {
  const { data, error, isLoading } = useCatalogue("spells", campaignId, {
    enabled: hasCampaignId && enabled,
  });

  return {
    availableSpells: data,
    spellsError: error,
    isSpellsLoading: isLoading,
  };
}
