import { useEffect, useState } from "react";

import {
  DEFAULT_HENCHMEN_LEVEL_THRESHOLDS,
  DEFAULT_HERO_LEVEL_THRESHOLDS,
  formatThresholdList,
  normalizeThresholdList,
  parseThresholdText,
} from "@/features/warbands/utils/level-thresholds";

import type { CampaignSummary } from "../../types/campaign-types";
import { useCampaignSave } from "./useCampaignSave";

export const heroThresholds = (thresholds: number[] | undefined) =>
  normalizeThresholdList(thresholds, DEFAULT_HERO_LEVEL_THRESHOLDS);
export const henchmenThresholds = (thresholds: number[] | undefined) =>
  normalizeThresholdList(thresholds, DEFAULT_HENCHMEN_LEVEL_THRESHOLDS);

/**
 * The XP tables at which heroes, henchmen and hired swords level up, as drafts saved together with
 * one PATCH. A settings answer that changes any of them resets every draft (a cached answer keeps
 * unchanged arrays as they were, so only real changes count).
 */
export function useLevelUpsForm(campaign: CampaignSummary) {
  const { hero_level_thresholds, henchmen_level_thresholds, hired_sword_level_thresholds } =
    campaign;
  const [heroText, setHeroText] = useState("");
  const [henchmenText, setHenchmenText] = useState("");
  const [hiredSwordText, setHiredSwordText] = useState("");
  const [errors, setErrors] = useState({ hero: "", henchmen: "", hiredSword: "" });
  const levelUps = useCampaignSave(campaign.id, "Unable to save level ups.");
  const resetSaveError = levelUps.setError;

  useEffect(() => {
    setHeroText(formatThresholdList(heroThresholds(hero_level_thresholds)));
    setHenchmenText(formatThresholdList(henchmenThresholds(henchmen_level_thresholds)));
    setHiredSwordText(formatThresholdList(henchmenThresholds(hired_sword_level_thresholds)));
    setErrors({ hero: "", henchmen: "", hiredSword: "" });
    resetSaveError("");
  }, [
    hero_level_thresholds,
    henchmen_level_thresholds,
    hired_sword_level_thresholds,
    resetSaveError,
  ]);

  const save = async () => {
    const hero = parseThresholdText(heroText);
    const henchmen = parseThresholdText(henchmenText);
    const hiredSword = parseThresholdText(hiredSwordText);
    setErrors({ hero: hero.error, henchmen: henchmen.error, hiredSword: hiredSword.error });
    levelUps.setError("");
    if (hero.error || henchmen.error || hiredSword.error) return;
    await levelUps.save({
      hero_level_thresholds: hero.values,
      henchmen_level_thresholds: henchmen.values,
      hired_sword_level_thresholds: hiredSword.values,
    });
  };

  return {
    heroText,
    setHeroText,
    henchmenText,
    setHenchmenText,
    hiredSwordText,
    setHiredSwordText,
    resetHero: () => setHeroText(formatThresholdList(DEFAULT_HERO_LEVEL_THRESHOLDS)),
    resetHenchmen: () => setHenchmenText(formatThresholdList(DEFAULT_HENCHMEN_LEVEL_THRESHOLDS)),
    // hired swords level up like henchmen, so the same levels and gaps (William, 12 Nov 2026)
    resetHiredSword: () =>
      setHiredSwordText(formatThresholdList(DEFAULT_HENCHMEN_LEVEL_THRESHOLDS)),
    errors: { ...errors, save: levelUps.error },
    isSaving: levelUps.saving,
    save,
  };
}
