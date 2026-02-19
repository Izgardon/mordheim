import { useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { Label } from "@components/label";
import { useMediaQuery } from "@/lib/use-media-query";
import CollapsibleSection from "@/components/ui/collapsible-section";

import { updateCampaign } from "../../api/campaigns-api";
import {
  DEFAULT_HERO_LEVEL_THRESHOLDS,
  DEFAULT_HENCHMEN_LEVEL_THRESHOLDS,
  formatThresholdList,
  normalizeThresholdList,
  parseThresholdText,
} from "@/features/warbands/utils/level-thresholds";

import type { CampaignSummary } from "../../types/campaign-types";

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
  const [heroText, setHeroText] = useState("");
  const [henchmenText, setHenchmenText] = useState("");
  const [hiredSwordText, setHiredSwordText] = useState("");
  const [errors, setErrors] = useState({
    hero: "",
    henchmen: "",
    hiredSwords: "",
    save: "",
  });
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

    setHeroText(formatThresholdList(heroThresholds));
    setHenchmenText(formatThresholdList(henchmenThresholds));
    setHiredSwordText(formatThresholdList(hiredSwordThresholds));
    setErrors({ hero: "", henchmen: "", hiredSwords: "", save: "" });
  }, [
    campaign.hero_level_thresholds,
    campaign.henchmen_level_thresholds,
    campaign.hired_sword_level_thresholds,
  ]);

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

  const resetHero = () => setHeroText(formatThresholdList(DEFAULT_HERO_LEVEL_THRESHOLDS));
  const resetHenchmen = () => setHenchmenText(formatThresholdList(DEFAULT_HENCHMEN_LEVEL_THRESHOLDS));
  const resetHiredSwords = () => setHiredSwordText(formatThresholdList(DEFAULT_HENCHMEN_LEVEL_THRESHOLDS));

  const isMobile = useMediaQuery("(max-width: 960px)")

  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-6 p-3" : "space-y-6 p-6"}>
      <h3 className="text-lg font-semibold text-foreground">Progression</h3>
      <CollapsibleSection
        title="Level ups"
        collapsed={collapsed}
        onToggle={() => setCollapsed((current) => !current)}
        summary={summary}
      >
        <div className="space-y-5">
          <div className="space-y-2">
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
            {errors.hero ? <p className="text-sm text-red-600">{errors.hero}</p> : null}
          </div>

          <div className="space-y-2">
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
            {errors.henchmen ? <p className="text-sm text-red-600">{errors.henchmen}</p> : null}
          </div>

          <div className="space-y-2">
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
            {errors.hiredSwords ? <p className="text-sm text-red-600">{errors.hiredSwords}</p> : null}
          </div>

          {errors.save ? <p className="text-sm text-red-600">{errors.save}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save level ups"}
            </Button>
          </div>
        </div>
      </CollapsibleSection>
    </CardBackground>
  );
}
