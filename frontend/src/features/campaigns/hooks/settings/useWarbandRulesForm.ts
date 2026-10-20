import { useEffect, useState } from "react";

// api
import { useUpdateCampaign } from "../useCampaignQuery";

// other
import { getErrorMessage } from "@/lib/get-error-message";
import {
  DEFAULT_HENCHMEN_LEVEL_THRESHOLDS,
  DEFAULT_HERO_LEVEL_THRESHOLDS,
  formatThresholdList,
  normalizeThresholdList,
  parseThresholdText,
} from "@/features/warbands/utils/level-thresholds";

// types
import type {
  CampaignHeroDeathRoll,
  CampaignSummary,
  CampaignUpdatePayload,
} from "../../types/campaign-types";

const heroThresholds = (thresholds: number[] | undefined) =>
  normalizeThresholdList(thresholds, DEFAULT_HERO_LEVEL_THRESHOLDS);
const henchmenThresholds = (thresholds: number[] | undefined) =>
  normalizeThresholdList(thresholds, DEFAULT_HENCHMEN_LEVEL_THRESHOLDS);

/** One of the card's Save buttons: its pending flag, its error, and the PATCH it sends. */
function useSaveAction(campaignId: number, fallback: string) {
  const updateCampaign = useUpdateCampaign(campaignId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (payload: CampaignUpdatePayload) => {
    setError("");
    setIsSaving(true);
    try {
      await updateCampaign(payload);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, fallback));
    } finally {
      setIsSaving(false);
    }
  };
  return { isSaving, error, setError, save };
}

/**
 * The Warband card's drafts (the owner's limits, hero death roll and level-up tables). A settings
 * answer resets every draft, and each Save PATCHes its own fields into the cached campaign.
 */
export function useWarbandRulesForm(campaign: CampaignSummary) {
  const [maxHeroes, setMaxHeroes] = useState(String(campaign.max_heroes ?? 6));
  const [maxHiredSwords, setMaxHiredSwords] = useState(String(campaign.max_hired_swords ?? 3));
  const [heroDeathRoll, setHeroDeathRoll] = useState<CampaignHeroDeathRoll>(
    campaign.hero_death_roll ?? "d66"
  );
  const [heroText, setHeroText] = useState("");
  const [henchmenText, setHenchmenText] = useState("");
  const [thresholdErrors, setThresholdErrors] = useState({ hero: "", henchmen: "" });
  const limits = useSaveAction(campaign.id, "Unable to save warband limits.");
  const deathRoll = useSaveAction(campaign.id, "Unable to save hero death roll.");
  const levelUps = useSaveAction(campaign.id, "Unable to save level ups.");
  const resetLevelUpsError = levelUps.setError;
  const {
    max_heroes,
    max_hired_swords,
    hero_death_roll,
    hero_level_thresholds,
    henchmen_level_thresholds,
  } = campaign;

  // A change to any of the card's settings resets every draft (a cached answer keeps unchanged
  // arrays as they were, so only real changes count).
  useEffect(() => {
    setMaxHeroes(String(max_heroes ?? 6));
    setMaxHiredSwords(String(max_hired_swords ?? 3));
    setHeroDeathRoll(hero_death_roll ?? "d66");
    setHeroText(formatThresholdList(heroThresholds(hero_level_thresholds)));
    setHenchmenText(formatThresholdList(henchmenThresholds(henchmen_level_thresholds)));
    setThresholdErrors({ hero: "", henchmen: "" });
    resetLevelUpsError("");
  }, [
    max_heroes,
    max_hired_swords,
    hero_death_roll,
    hero_level_thresholds,
    henchmen_level_thresholds,
    resetLevelUpsError,
  ]);

  const maxHeroesValue = Number(maxHeroes);
  const maxHiredSwordsValue = Number(maxHiredSwords);

  const saveLimits = async () => {
    if (Number.isNaN(maxHeroesValue) || Number.isNaN(maxHiredSwordsValue)) {
      limits.setError("Enter numeric limits for heroes and hired swords.");
      return;
    }
    await limits.save({ max_heroes: maxHeroesValue, max_hired_swords: maxHiredSwordsValue });
  };

  const saveLevelUps = async () => {
    const hero = parseThresholdText(heroText);
    const henchmen = parseThresholdText(henchmenText);
    setThresholdErrors({ hero: hero.error, henchmen: henchmen.error });
    levelUps.setError("");
    if (hero.error || henchmen.error) {
      return;
    }
    await levelUps.save({
      hero_level_thresholds: hero.values,
      henchmen_level_thresholds: henchmen.values,
    });
  };

  return {
    limits: {
      maxHeroes,
      setMaxHeroes,
      maxHiredSwords,
      setMaxHiredSwords,
      hasChanged:
        maxHeroesValue !== (max_heroes ?? 6) || maxHiredSwordsValue !== (max_hired_swords ?? 3),
      isSaving: limits.isSaving,
      error: limits.error,
      save: saveLimits,
    },
    deathRoll: {
      value: heroDeathRoll,
      setValue: setHeroDeathRoll,
      hasChanged: heroDeathRoll !== (hero_death_roll ?? "d66"),
      isSaving: deathRoll.isSaving,
      error: deathRoll.error,
      save: () => deathRoll.save({ hero_death_roll: heroDeathRoll }),
    },
    levelUps: {
      heroText,
      setHeroText,
      henchmenText,
      setHenchmenText,
      resetHero: () => setHeroText(formatThresholdList(DEFAULT_HERO_LEVEL_THRESHOLDS)),
      resetHenchmen: () => setHenchmenText(formatThresholdList(DEFAULT_HENCHMEN_LEVEL_THRESHOLDS)),
      heroCount: heroThresholds(hero_level_thresholds).length,
      henchmenCount: henchmenThresholds(henchmen_level_thresholds).length,
      errors: { ...thresholdErrors, save: levelUps.error },
      isSaving: levelUps.isSaving,
      save: saveLevelUps,
    },
  };
}
