import { useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";

import { updateCampaign } from "../../api/campaigns-api";

import type { CampaignSummary } from "../../types/campaign-types";

type CampaignControlCardProps = {
  campaign: CampaignSummary;
};

export default function CampaignControlCard({ campaign }: CampaignControlCardProps) {
  const [startingGold, setStartingGold] = useState("500");
  const [maxHeroes, setMaxHeroes] = useState(String(campaign.max_heroes ?? 6));
  const [maxHiredSwords, setMaxHiredSwords] = useState(String(campaign.max_hired_swords ?? 3));
  const [limitsError, setLimitsError] = useState("");
  const [isSavingLimits, setIsSavingLimits] = useState(false);

  useEffect(() => {
    setMaxHeroes(String(campaign.max_heroes ?? 6));
    setMaxHiredSwords(String(campaign.max_hired_swords ?? 3));
  }, [campaign.max_heroes, campaign.max_hired_swords]);

  const maxHeroesValue = useMemo(() => Number(maxHeroes), [maxHeroes]);
  const maxHiredSwordsValue = useMemo(() => Number(maxHiredSwords), [maxHiredSwords]);

  const handleSaveLimits = async () => {
    if (Number.isNaN(maxHeroesValue) || Number.isNaN(maxHiredSwordsValue)) {
      setLimitsError("Enter numeric limits for heroes and hired swords.");
      return;
    }

    setLimitsError("");
    setIsSavingLimits(true);

    try {
      await updateCampaign(campaign.id, {
        max_heroes: maxHeroesValue,
        max_hired_swords: maxHiredSwordsValue,
      });
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

  return (
    <CardBackground className="space-y-6 p-6">
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
            <Button type="button" variant="secondary">
              Confirm gold
            </Button>
          </div>
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
              disabled={isSavingLimits}
              className="self-end"
            >
              {isSavingLimits ? "Saving..." : "Save limits"}
            </Button>
          </div>
          {limitsError ? <p className="text-sm text-red-600">{limitsError}</p> : null}
        </div>
    </CardBackground>
  );
}

