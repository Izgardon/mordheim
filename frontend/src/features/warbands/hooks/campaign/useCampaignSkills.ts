import { useCallback, useEffect, useMemo, useState } from "react";
import { listSkills } from "@/features/skills/api/skills-api";
import { useAppStore } from "@/stores/app-store";

type UseCampaignSkillsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
};

export function useCampaignSkills(params: UseCampaignSkillsParams) {
  const isEnabled = params.enabled ?? true;
  const isAuto = params.auto ?? true;
  const { skillsCache, setSkillsCache } = useAppStore();
  const campaignKey = Number.isNaN(params.campaignId) ? "base" : `campaign:${params.campaignId}`;
  const cacheEntry = skillsCache[campaignKey];
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const availableSkills = useMemo(() => cacheEntry?.data ?? [], [cacheEntry]);

  const loadSkills = useCallback(async () => {
    if (!isEnabled || !params.hasCampaignId || Number.isNaN(params.campaignId)) {
      return [];
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await listSkills({ campaignId: params.campaignId });
      setSkillsCache(campaignKey, result);
      return result;
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load skills");
      } else {
        setError("Unable to load skills");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [campaignKey, isEnabled, params.campaignId, params.hasCampaignId, setSkillsCache]);

  useEffect(() => {
    if (!isEnabled || !isAuto || cacheEntry?.loaded) {
      return;
    }
    void loadSkills();
  }, [cacheEntry?.loaded, isAuto, isEnabled, loadSkills]);

  return {
    availableSkills,
    skillsError: error,
    isSkillsLoading: isLoading,
    loadSkills,
  };
}
