import { useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";
import CollapsibleSection from "@/components/ui/collapsible-section";

import { updateCampaign } from "../../api/campaigns-api";
import {
  DEFAULT_HERO_LEVEL_THRESHOLDS,
  DEFAULT_HENCHMEN_LEVEL_THRESHOLDS,
  formatThresholdList,
  normalizeThresholdList,
  parseThresholdText,
} from "@/features/warbands/utils/level-thresholds";

import type { CampaignHeroDeathRoll, CampaignSummary } from "../../types/campaign-types";

type CampaignLevelUpSettingsCardProps = {
  campaign: CampaignSummary;
  onCampaignUpdated?: (campaign: CampaignSummary) => void;
};

const textareaClassName =
  "min-h-[120px] w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground shadow-[0_12px_22px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_22px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]";

export default function CampaignLevelUpSettingsCard({
  campaign,
  onCampaignUpdated,
}: CampaignLevelUpSettingsCardProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [startingGold, setStartingGold] = useState(String(campaign.starting_gold ?? 500));
  const [maxHeroes, setMaxHeroes] = useState(String(campaign.max_heroes ?? 6));
  const [maxHiredSwords, setMaxHiredSwords] = useState(String(campaign.max_hired_swords ?? 3));
  const [heroDeathRoll, setHeroDeathRoll] = useState<CampaignHeroDeathRoll>(campaign.hero_death_roll ?? "d66");
  const [heroText, setHeroText] = useState("");
  const [henchmenText, setHenchmenText] = useState("");
  const [hiredSwordText, setHiredSwordText] = useState("");
  const [goldError, setGoldError] = useState("");
  const [limitsError, setLimitsError] = useState("");
  const [heroDeathRollError, setHeroDeathRollError] = useState("");
  const [errors, setErrors] = useState({
    hero: "",
    henchmen: "",
    hiredSwords: "",
    save: "",
  });
  const [isSavingGold, setIsSavingGold] = useState(false);
  const [isSavingLimits, setIsSavingLimits] = useState(false);
  const [isSavingHeroDeathRoll, setIsSavingHeroDeathRoll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const heroThresholds = normalizeThresholdList(
      campaign.hero_level_thresholds,
      DEFAULT_HERO_LEVEL_THRESHOLDS
    );
    const henchmenThresholds = normalizeThresholdList(
      campaign.henchmen_level_thresholds,
      DEFAULT_HENCHMEN_LEVEL_THRESHOLDS
    );
    const hiredSwordThresholds = normalizeThresholdList(
      campaign.hired_sword_level_thresholds,
      DEFAULT_HENCHMEN_LEVEL_THRESHOLDS
    );

    setStartingGold(String(campaign.starting_gold ?? 500));
    setMaxHeroes(String(campaign.max_heroes ?? 6));
    setMaxHiredSwords(String(campaign.max_hired_swords ?? 3));
    setHeroDeathRoll(campaign.hero_death_roll ?? "d66");
    setHeroText(formatThresholdList(heroThresholds));
    setHenchmenText(formatThresholdList(henchmenThresholds));
    setHiredSwordText(formatThresholdList(hiredSwordThresholds));
    setErrors({ hero: "", henchmen: "", hiredSwords: "", save: "" });
  }, [
    campaign.starting_gold,
    campaign.max_heroes,
    campaign.max_hired_swords,
    campaign.hero_death_roll,
    campaign.hero_level_thresholds,
    campaign.henchmen_level_thresholds,
    campaign.hired_sword_level_thresholds,
  ]);

  const startingGoldValue = useMemo(() => Number(startingGold), [startingGold]);
  const maxHeroesValue = useMemo(() => Number(maxHeroes), [maxHeroes]);
  const maxHiredSwordsValue = useMemo(() => Number(maxHiredSwords), [maxHiredSwords]);
  const hasGoldChanged = startingGoldValue !== (campaign.starting_gold ?? 500);
  const hasLimitsChanged =
    maxHeroesValue !== (campaign.max_heroes ?? 6) ||
    maxHiredSwordsValue !== (campaign.max_hired_swords ?? 3);
  const hasHeroDeathRollChanged = heroDeathRoll !== (campaign.hero_death_roll ?? "d66");

  const summary = useMemo(() => {
    const heroCount = normalizeThresholdList(
      campaign.hero_level_thresholds,
      DEFAULT_HERO_LEVEL_THRESHOLDS
    ).length;
    const henchmenCount = normalizeThresholdList(
      campaign.henchmen_level_thresholds,
      DEFAULT_HENCHMEN_LEVEL_THRESHOLDS
    ).length;
    const hiredSwordCount = normalizeThresholdList(
      campaign.hired_sword_level_thresholds,
      DEFAULT_HENCHMEN_LEVEL_THRESHOLDS
    ).length;

    return (
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Heroes {heroCount} · Henchmen {henchmenCount} · Hired Swords {hiredSwordCount}
      </span>
    );
  }, [
    campaign.hero_level_thresholds,
    campaign.henchmen_level_thresholds,
    campaign.hired_sword_level_thresholds,
  ]);

  const handleSave = async () => {
    const heroParsed = parseThresholdText(heroText);
    const henchmenParsed = parseThresholdText(henchmenText);
    const hiredSwordParsed = parseThresholdText(hiredSwordText);

    const nextErrors = {
      hero: heroParsed.error,
      henchmen: henchmenParsed.error,
      hiredSwords: hiredSwordParsed.error,
      save: "",
    };

    setErrors(nextErrors);

    if (heroParsed.error || henchmenParsed.error || hiredSwordParsed.error) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateCampaign(campaign.id, {
        hero_level_thresholds: heroParsed.values,
        henchmen_level_thresholds: henchmenParsed.values,
        hired_sword_level_thresholds: hiredSwordParsed.values,
      });
      onCampaignUpdated?.(updated);
    } catch (errorResponse) {
      const message =
        errorResponse instanceof Error
          ? errorResponse.message || "Unable to save level ups."
          : "Unable to save level ups.";
      setErrors((prev) => ({ ...prev, save: message }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGold = async () => {
    if (Number.isNaN(startingGoldValue) || startingGoldValue < 0) {
      setGoldError("Enter a valid starting gold amount.");
      return;
    }

    setGoldError("");
    setIsSavingGold(true);

    try {
      const updated = await updateCampaign(campaign.id, {
        starting_gold: startingGoldValue,
      });
      onCampaignUpdated?.(updated);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setGoldError(errorResponse.message || "Unable to save starting gold.");
      } else {
        setGoldError("Unable to save starting gold.");
      }
    } finally {
      setIsSavingGold(false);
    }
  };

  const handleSaveLimits = async () => {
    if (Number.isNaN(maxHeroesValue) || Number.isNaN(maxHiredSwordsValue)) {
      setLimitsError("Enter numeric limits for heroes and hired swords.");
      return;
    }

    setLimitsError("");
    setIsSavingLimits(true);

    try {
      const updated = await updateCampaign(campaign.id, {
        max_heroes: maxHeroesValue,
        max_hired_swords: maxHiredSwordsValue,
      });
      onCampaignUpdated?.(updated);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setLimitsError(errorResponse.message || "Unable to save warband limits.");
      } else {
        setLimitsError("Unable to save warband limits.");
      }
    } finally {
      setIsSavingLimits(false);
    }
  };

  const handleSaveHeroDeathRoll = async () => {
    setHeroDeathRollError("");
    setIsSavingHeroDeathRoll(true);

    try {
      const updated = await updateCampaign(campaign.id, {
        hero_death_roll: heroDeathRoll,
      });
      onCampaignUpdated?.(updated);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setHeroDeathRollError(errorResponse.message || "Unable to save hero death roll.");
      } else {
        setHeroDeathRollError("Unable to save hero death roll.");
      }
    } finally {
      setIsSavingHeroDeathRoll(false);
    }
  };

  const resetHero = () => setHeroText(formatThresholdList(DEFAULT_HERO_LEVEL_THRESHOLDS));
  const resetHenchmen = () => setHenchmenText(formatThresholdList(DEFAULT_HENCHMEN_LEVEL_THRESHOLDS));
  const resetHiredSwords = () => setHiredSwordText(formatThresholdList(DEFAULT_HENCHMEN_LEVEL_THRESHOLDS));

  return (
    <CardBackground className="space-y-2 p-3 bg-[rgba(12,9,6,0.92)] sm:space-y-2.5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Warband</h3>
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-foreground">Starting gold</Label>
        <div className="flex flex-wrap justify-between items-end gap-3">
          <NumberInput
            min={0}
            placeholder="0"
            value={startingGold}
            onChange={(event) => setStartingGold(event.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveGold}
            disabled={isSavingGold || !hasGoldChanged}
          >
            {isSavingGold ? "Saving" : "Save"}
          </Button>
        </div>
        <p className="min-h-[1.25rem] text-sm text-red-600">{goldError}</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-foreground">Warband limits</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid grid-cols-2 gap-3 sm:contents">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Max heroes
              </Label>
              <NumberInput
                min={0}
                placeholder="0"
                value={maxHeroes}
                onChange={(event) => setMaxHeroes(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Max hired swords
              </Label>
              <NumberInput
                min={0}
                placeholder="0"
                value={maxHiredSwords}
                onChange={(event) => setMaxHiredSwords(event.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveLimits}
            disabled={isSavingLimits || !hasLimitsChanged}
            className="self-end sm:ml-auto"
          >
            {isSavingLimits ? "Saving" : "Save"}
          </Button>
        </div>
        <p className="min-h-[1.25rem] text-sm text-red-600">{limitsError}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">Hero death roll table</Label>
        <div className="flex flex-wrap justify-between items-end gap-3">
          <div className="space-y-1">
            <select
              value={heroDeathRoll}
              onChange={(event) => setHeroDeathRoll(event.target.value as CampaignHeroDeathRoll)}
              className="h-9 min-w-30 rounded-md border border-border/60 bg-background/70 px-3 text-sm text-foreground"
            >
              <option value="d66">D66</option>
              <option value="d100">D100</option>
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveHeroDeathRoll}
            disabled={isSavingHeroDeathRoll || !hasHeroDeathRollChanged}
            className="self-end"
          >
            {isSavingHeroDeathRoll ? "Saving" : "Save"}
          </Button>
        </div>
        <p className="min-h-[1.25rem] text-sm text-red-600">{heroDeathRollError}</p>
      </div>

      <CollapsibleSection
        title="Level ups"
        collapsed={collapsed}
        onToggle={() => setCollapsed((current) => !current)}
        summary={summary}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold text-foreground">Heroes</Label>
              <Button type="button" variant="secondary" size="sm" onClick={resetHero}>
                Reset default
              </Button>
            </div>
            <textarea
              className={textareaClassName}
              value={heroText}
              onChange={(event) => setHeroText(event.target.value)}
              placeholder="2, 4, 6, 8, 11, 14..."
            />
            <p className="min-h-[1.25rem] text-sm text-red-600">{errors.hero}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold text-foreground">Henchmen</Label>
              <Button type="button" variant="secondary" size="sm" onClick={resetHenchmen}>
                Reset default
              </Button>
            </div>
            <textarea
              className={textareaClassName}
              value={henchmenText}
              onChange={(event) => setHenchmenText(event.target.value)}
              placeholder="2, 5, 9, 14"
            />
            <p className="min-h-[1.25rem] text-sm text-red-600">{errors.henchmen}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold text-foreground">Hired swords</Label>
              <Button type="button" variant="secondary" size="sm" onClick={resetHiredSwords}>
                Reset default
              </Button>
            </div>
            <textarea
              className={textareaClassName}
              value={hiredSwordText}
              onChange={(event) => setHiredSwordText(event.target.value)}
              placeholder="2, 5, 9, 14"
            />
            <p className="min-h-[1.25rem] text-sm text-red-600">{errors.hiredSwords}</p>
          </div>

          <p className="min-h-[1.25rem] text-sm text-red-600">{errors.save}</p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CollapsibleSection>
    </CardBackground>
  );
}
