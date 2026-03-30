import { useEffect, useMemo, useState } from "react";

import { X } from "lucide-react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { useMediaQuery } from "@/lib/use-media-query";
import RestrictionPicker from "@/features/warbands/components/shared/RestrictionPicker";
import { listRestrictions } from "@/features/items/api/items-api";

import { updateCampaign } from "../../api/campaigns-api";

import type { Restriction } from "@/features/items/types/item-types";
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
  const [availableSettings, setAvailableSettings] = useState<Restriction[]>([]);
  const [selectedSettings, setSelectedSettings] = useState<Restriction[]>(campaign.item_settings ?? []);
  const [isEditingItemSettings, setIsEditingItemSettings] = useState(false);
  const [goldError, setGoldError] = useState("");
  const [limitsError, setLimitsError] = useState("");
  const [heroDeathRollError, setHeroDeathRollError] = useState("");
  const [itemSettingsError, setItemSettingsError] = useState("");
  const [isSavingGold, setIsSavingGold] = useState(false);
  const [isSavingLimits, setIsSavingLimits] = useState(false);
  const [isSavingHeroDeathRoll, setIsSavingHeroDeathRoll] = useState(false);
  const [isSavingItemSettings, setIsSavingItemSettings] = useState(false);

  useEffect(() => {
    setStartingGold(String(campaign.starting_gold ?? 500));
    setMaxHeroes(String(campaign.max_heroes ?? 6));
    setMaxHiredSwords(String(campaign.max_hired_swords ?? 3));
    setHeroDeathRoll(campaign.hero_death_roll ?? "d66");
    setSelectedSettings(campaign.item_settings ?? []);
  }, [campaign.starting_gold, campaign.max_heroes, campaign.max_hired_swords, campaign.hero_death_roll, campaign.item_settings]);

  useEffect(() => {
    listRestrictions({ type: "Setting" })
      .then(setAvailableSettings)
      .catch(() => setAvailableSettings([]));
  }, []);

  const startingGoldValue = useMemo(() => Number(startingGold), [startingGold]);
  const maxHeroesValue = useMemo(() => Number(maxHeroes), [maxHeroes]);
  const maxHiredSwordsValue = useMemo(() => Number(maxHiredSwords), [maxHiredSwords]);
  const selectedSettingIds = useMemo(
    () => new Set(selectedSettings.map((restriction) => restriction.id)),
    [selectedSettings]
  );

  const hasGoldChanged = startingGoldValue !== (campaign.starting_gold ?? 500);
  const hasLimitsChanged =
    maxHeroesValue !== (campaign.max_heroes ?? 6) ||
    maxHiredSwordsValue !== (campaign.max_hired_swords ?? 3);
  const hasHeroDeathRollChanged = heroDeathRoll !== (campaign.hero_death_roll ?? "d66");
  const hasItemSettingsChanged = useMemo(() => {
    const currentIds = (campaign.item_settings ?? []).map((restriction) => restriction.id).sort((a, b) => a - b);
    const nextIds = selectedSettings.map((restriction) => restriction.id).sort((a, b) => a - b);

    if (currentIds.length !== nextIds.length) {
      return true;
    }

    return currentIds.some((id, index) => id !== nextIds[index]);
  }, [campaign.item_settings, selectedSettings]);

  const handleToggleSetting = (restriction: Restriction) => {
    setSelectedSettings((prev) =>
      prev.some((entry) => entry.id === restriction.id)
        ? prev.filter((entry) => entry.id !== restriction.id)
        : [...prev, restriction]
    );
  };

  const handleRemoveSetting = (restrictionId: number) => {
    setSelectedSettings((prev) => prev.filter((entry) => entry.id !== restrictionId));
  };

  const handleCancelItemSettings = () => {
    setIsEditingItemSettings(false);
    setSelectedSettings(campaign.item_settings ?? []);
    setItemSettingsError("");
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

  const handleSaveItemSettings = async () => {
    setItemSettingsError("");
    setIsSavingItemSettings(true);

    try {
      const updated = await updateCampaign(campaign.id, {
        item_setting_ids: selectedSettings.map((restriction) => restriction.id),
      });
      onCampaignUpdated?.(updated);
      setIsEditingItemSettings(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setItemSettingsError(errorResponse.message || "Unable to save item settings.");
      } else {
        setItemSettingsError("Unable to save item settings.");
      }
    } finally {
      setIsSavingItemSettings(false);
    }
  };

  const isMobile = useMediaQuery("(max-width: 960px)")

  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-2 p-3" : "space-y-2.5 p-6"}>
      <h3 className="text-lg font-semibold text-foreground">Campaign</h3>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-semibold text-foreground">Item settings</Label>
              <p className="text-sm text-muted-foreground">
                Campaign-wide setting restrictions applied to every warband for item availability.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isEditingItemSettings ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancelItemSettings}
                    disabled={isSavingItemSettings}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSaveItemSettings}
                    disabled={isSavingItemSettings || !hasItemSettingsChanged}
                  >
                    {isSavingItemSettings ? "Saving" : "Save"}
                  </Button>
                </>
              ) : (
                <Button type="button" variant="secondary" onClick={() => setIsEditingItemSettings(true)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
          {selectedSettings.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedSettings.map((restriction) => (
                <div
                  key={restriction.id}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-0.5 text-sm"
                >
                  <span>{restriction.restriction}</span>
                  {isEditingItemSettings ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveSetting(restriction.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No item settings selected.</p>
          )}
          {isEditingItemSettings ? (
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <RestrictionPicker
                restrictions={availableSettings}
                selected={selectedSettingIds}
                onToggle={handleToggleSetting}
                showFilter={false}
              />
            </div>
          ) : null}
          <p className="min-h-[1.25rem] text-sm text-red-600">{itemSettingsError}</p>
        </div>

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
              className="ml-auto"
            >
              {isSavingLimits ? "Saving" : "Save"}
            </Button>
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
    </CardBackground>
  );
}

