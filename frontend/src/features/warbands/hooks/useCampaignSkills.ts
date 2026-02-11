import { listSkills } from "../../skills/api/skills-api";
import { useCampaignData } from "./useCampaignData";

type UseCampaignSkillsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignSkills(params: UseCampaignSkillsParams) {
  const { data, setData, error, isLoading, reload } = useCampaignData({
    ...params,
    fetchFn: listSkills,
    label: "skills",
  });

  return {
    availableSkills: data,
    setAvailableSkills: setData,
    skillsError: error,
    isSkillsLoading: isLoading,
    loadSkills: reload,
  };
}
