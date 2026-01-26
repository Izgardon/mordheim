import { useCallback, useEffect, useState } from "react";

import { listSkills } from "../../skills/api/skills-api";

import type { Skill } from "../../skills/types/skill-types";

type UseCampaignSkillsParams = {
  campaignId: number;
  hasCampaignId: boolean;
};

export function useCampaignSkills({ campaignId, hasCampaignId }: UseCampaignSkillsParams) {
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [skillsError, setSkillsError] = useState("");
  const [isSkillsLoading, setIsSkillsLoading] = useState(false);

  const loadSkills = useCallback(async () => {
    if (!hasCampaignId || Number.isNaN(campaignId)) {
      return;
    }
    setIsSkillsLoading(true);
    setSkillsError("");

    try {
      const data = await listSkills({ campaignId });
      setAvailableSkills(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSkillsError(errorResponse.message || "Unable to load skills");
      } else {
        setSkillsError("Unable to load skills");
      }
    } finally {
      setIsSkillsLoading(false);
    }
  }, [campaignId, hasCampaignId]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  return {
    availableSkills,
    setAvailableSkills,
    skillsError,
    isSkillsLoading,
    loadSkills,
  };
}
