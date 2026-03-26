import { useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { useMediaQuery } from "@/lib/use-media-query";

import { updateCampaign } from "../../api/campaigns-api";

import type { CampaignHeroDeathRoll, CampaignSummary } from "../../types/campaign-types";

type CampaignControlCardProps = {
  campaign: CampaignSummary;
  onCampaignUpdated?: (campaign: CampaignSummary) => void;
};

export default function CampaignControlCard({ campaign, onCampaignUpdated }: CampaignControlCardProps) {
  const [startingGold, setStartingGold] = useState(String(campaign.starting_gold ?? 500));
  const [maxHeroes, setMaxHeroes] = useState(String(campaign.max_heroes ?? 6));
  const [maxHiredSwords, setMaxHiredSwords] = useState(String(campaign.max_hired_swords ?? 3));
  const [heroDeathRoll, setHeroDeathRoll] = useState<CampaignHeroDeathRoll>(campaign.hero_death_roll ?? "d66");
  const [goldError, setGoldError] = useState("");
  const [limitsError, setLimitsError] = useState("");
  const [heroDeathRollError, setHeroDeathRollError] = useState("");
  const [isSavingGold, setIsSavingGold] = useState(false);
  const [isSavingLimits, setIsSavingLimits] = useState(false);
  const [isSavingHeroDeathRoll, setIsSavingHeroDeathRoll] = useState(false);

  useEffect(() => {
    setStartingGold(String(campaign.starting_gold ?? 500));
    setMaxHeroes(String(campaign.max_heroes ?? 6));
    setMaxHiredSwords(String(campaign.max_hired_swords ?? 3));
    setHeroDeathRoll(campaign.hero_death_roll ?? "d66");
  }, [campaign.starting_gold, campaign.max_heroes, campaign.max_hired_swords, campaign.hero_death_roll]);

  const startingGoldValue = useMemo(() => Number(startingGold), [startingGold]);
  const maxHeroesValue = useMemo(() => Number(maxHeroes), [maxHeroes]);
  const maxHiredSwordsValue = useMemo(() => Number(maxHiredSwords), [maxHiredSwords]);

  const hasGoldChanged = startingGoldValue !== (campaign.starting_gold ?? 500);
  const hasLimitsChanged =
    maxHeroesValue !== (campaign.max_heroes ?? 6) ||
    maxHiredSwordsValue !== (campaign.max_hired_swords ?? 3);
  const hasHeroDeathRollChanged = heroDeathRoll !== (campaign.hero_death_roll ?? "d66");

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
        setLimitsError(errorResponse.message || "Unable to save campaign limits.");
      } else {
        setLimitsError("Unable to save campaign limits.");
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

  const isMobile = useMediaQuery("(max-width: 960px)")

  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-6 p-3" : "space-y-6 p-6"}>
      <h3 className="text-lg font-semibold text-foreground">Campaign</h3>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Starting gold</Label>
          <div className="flex flex-wrap items-end gap-3">
            <NumberInput
              min={0}
              placeholder="0"
              value={startingGold}
              onChange={(event) => setStartingGold(event.target.value)}
              className="w-40"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveGold}
              disabled={isSavingGold || !hasGoldChanged}
            >
              {isSavingGold ? "Saving..." : "Confirm gold"}
            </Button>
          </div>
          {goldError ? <p className="text-sm text-red-600">{goldError}</p> : null}
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">Warband limits</Label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Max heroes
              </Label>
                <NumberInput
                  min={0}
                  placeholder="0"
                  value={maxHeroes}
                onChange={(event) => setMaxHeroes(event.target.value)}
                className="w-40"
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
                className="w-48"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveLimits}
              disabled={isSavingLimits || !hasLimitsChanged}
              className="self-end"
            >
              {isSavingLimits ? "Saving..." : "Save limits"}
            </Button>
          </div>
          {limitsError ? <p className="text-sm text-red-600">{limitsError}</p> : null}
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">Hero death roll</Label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Serious injury table
              </Label>
              <select
                value={heroDeathRoll}
                onChange={(event) => setHeroDeathRoll(event.target.value as CampaignHeroDeathRoll)}
                className="h-10 min-w-40 rounded-md border border-border/60 bg-background/70 px-3 text-sm text-foreground"
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
              {isSavingHeroDeathRoll ? "Saving..." : "Save roll"}
            </Button>
          </div>
          {heroDeathRollError ? <p className="text-sm text-red-600">{heroDeathRollError}</p> : null}
        </div>
    </CardBackground>
  );
}

