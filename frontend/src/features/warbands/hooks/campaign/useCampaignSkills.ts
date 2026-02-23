import { useCallback } from "react";
import { listSkills } from "@/features/skills/api/skills-api";
import { useAppStore } from "@/stores/app-store";
import { useCampaignData } from "./useCampaignData";

type UseCampaignSkillsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
};

export function useCampaignSkills(params: UseCampaignSkillsParams) {
  const { setSkillsCache } = useAppStore();
  const campaignKey = Number.isNaN(params.campaignId) ? "base" : `campaign:${params.campaignId}`;
  const { data, setData, error, isLoading, reload } = useCampaignData({
    ...params,
    fetchFn: listSkills,
    label: "skills",
  });

  const loadSkills = useCallback(async () => {
    const result = await reload();
    setSkillsCache(campaignKey, result);
  }, [reload, setSkillsCache, campaignKey]);

  return {
    availableSkills: data,
    setAvailableSkills: setData,
    skillsError: error,
    isSkillsLoading: isLoading,
    loadSkills,
  };
}
