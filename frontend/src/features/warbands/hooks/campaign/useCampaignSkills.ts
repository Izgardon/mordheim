import { useCatalogue } from "@/lib/catalogue-queries";

type UseCampaignSkillsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignSkills({
  campaignId,
  hasCampaignId,
  enabled = true,
}: UseCampaignSkillsParams) {
  const { data, error, isLoading } = useCatalogue("skills", campaignId, {
    enabled: hasCampaignId && enabled,
  });

  return {
    availableSkills: data,
    skillsError: error,
    isSkillsLoading: isLoading,
  };
}
