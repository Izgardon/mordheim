import { useEffect, useState } from "react";

import type { CampaignHeroDeathRoll, CampaignSummary } from "../../types/campaign-types";
import { useCampaignSave } from "./useCampaignSave";

/**
 * The owner's warband limits and hero death roll, as drafts. A settings answer resets them, and
 * each Save PATCHes its own fields into the cached campaign.
 */
export function useWarbandLimitsForm(campaign: CampaignSummary) {
  const { max_heroes, max_hired_swords, hero_death_roll } = campaign;
  const [maxHeroes, setMaxHeroes] = useState(String(max_heroes ?? 6));
  const [maxHiredSwords, setMaxHiredSwords] = useState(String(max_hired_swords ?? 3));
  const [heroDeathRoll, setHeroDeathRoll] = useState<CampaignHeroDeathRoll>(
    hero_death_roll ?? "d66"
  );
  const limits = useCampaignSave(campaign.id, "Unable to save warband limits.");
  const deathRoll = useCampaignSave(campaign.id, "Unable to save hero death roll.");

  useEffect(() => {
    setMaxHeroes(String(max_heroes ?? 6));
    setMaxHiredSwords(String(max_hired_swords ?? 3));
    setHeroDeathRoll(hero_death_roll ?? "d66");
  }, [max_heroes, max_hired_swords, hero_death_roll]);

  const maxHeroesValue = Number(maxHeroes);
  const maxHiredSwordsValue = Number(maxHiredSwords);

  const saveLimits = async () => {
    if (Number.isNaN(maxHeroesValue) || Number.isNaN(maxHiredSwordsValue)) {
      limits.setError("Enter numeric limits for heroes and hired swords.");
      return;
    }
    await limits.save({ max_heroes: maxHeroesValue, max_hired_swords: maxHiredSwordsValue });
  };

  return {
    limits: {
      maxHeroes,
      setMaxHeroes,
      maxHiredSwords,
      setMaxHiredSwords,
      hasChanged:
        maxHeroesValue !== (max_heroes ?? 6) || maxHiredSwordsValue !== (max_hired_swords ?? 3),
      isSaving: limits.saving,
      error: limits.error,
      save: saveLimits,
    },
    deathRoll: {
      value: heroDeathRoll,
      setValue: setHeroDeathRoll,
      hasChanged: heroDeathRoll !== (hero_death_roll ?? "d66"),
      isSaving: deathRoll.saving,
      error: deathRoll.error,
      save: () => deathRoll.save({ hero_death_roll: heroDeathRoll }),
    },
  };
}
