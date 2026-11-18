import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import { usePresetLocks } from "../../api/preset-queries";
import { useWarbandRulesForm } from "../../hooks/settings/useWarbandRulesForm";
import type { CampaignHeroDeathRoll, CampaignSummary } from "../../types/campaign-types";
import DefaultResource from "./DefaultResource";
import PresetNote, { presetDim } from "./PresetNote";
import StartingGold from "./StartingGold";
import { Field, FormError, SettingRow, SettingsCard, TEXTAREA } from "./settings-ui";
import WyrdstonePrices from "./WyrdstonePrices";

const DEATH_ROLLS: { id: CampaignHeroDeathRoll; label: string }[] = [
  { id: "d66", label: "D66" },
  { id: "d100", label: "D100" },
];

/** A threshold list's field with its Reset default. */
function ThresholdField(props: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  error: string;
  onChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <Field label={props.label} htmlFor={props.id} hint={props.hint}>
      <div className="flex items-start gap-2">
        <textarea
          id={props.id}
          rows={2}
          value={props.value}
          placeholder={props.placeholder}
          onChange={(event) => props.onChange(event.target.value)}
          className={`${TEXTAREA} min-h-[64px] font-mono`}
        />
        <Button variant="ghost" onClick={props.onReset}>
          Reset
        </Button>
      </div>
      <FormError message={props.error} />
    </Field>
  );
}

/**
 * The warband rules (`edit_settings`): starting gold, the default resource and its sell prices,
 * the most heroes and hired swords, the table a hero's death is rolled on, and the XP at which
 * heroes, henchmen and hired swords level up. Each saves on its own; a settings answer resets the
 * drafts. A limit the campaign's preset sets is greyed, still operable, and warns once departed.
 */
export default function CampaignRules({ campaign }: { campaign: CampaignSummary }) {
  const { limits, deathRoll, levelUps } = useWarbandRulesForm(campaign);
  const locks = usePresetLocks(campaign.id);
  return (
    <SettingsCard title="Warband rules">
      <StartingGold campaign={campaign} />
      <DefaultResource campaign={campaign} />
      <WyrdstonePrices campaign={campaign} />
      <SettingRow
        label="Warband limits"
        hint={<PresetNote locks={locks} field="max_heroes" />}
        error={limits.error}
      >
        <label className="flex items-center gap-2 text-sm text-text2">
          Heroes
          <NumberInput
            compact
            min={0}
            aria-label="Most heroes"
            value={limits.maxHeroes}
            onChange={(event) => limits.setMaxHeroes(event.target.value)}
            className={cn("w-[80px] font-mono", presetDim(locks, "max_heroes"))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-text2">
          Hired swords
          <NumberInput
            compact
            min={0}
            aria-label="Most hired swords"
            value={limits.maxHiredSwords}
            onChange={(event) => limits.setMaxHiredSwords(event.target.value)}
            className="w-[80px] font-mono"
          />
        </label>
        <Button
          variant="secondary"
          disabled={limits.isSaving || !limits.hasChanged}
          onClick={() => void limits.save()}
        >
          {limits.isSaving ? "Saving…" : "Save"}
        </Button>
      </SettingRow>
      <SettingRow
        label="Hero death roll"
        hint={<PresetNote locks={locks} field="hero_death_roll" />}
        error={deathRoll.error}
      >
        <div
          role="group"
          aria-label="Hero death roll"
          className={cn("flex gap-1.5", presetDim(locks, "hero_death_roll"))}
        >
          {DEATH_ROLLS.map((roll) => (
            <Chip
              key={roll.id}
              pressed={deathRoll.value === roll.id}
              onClick={() => deathRoll.setValue(roll.id)}
            >
              {roll.label}
            </Chip>
          ))}
        </div>
        <Button
          variant="secondary"
          disabled={deathRoll.isSaving || !deathRoll.hasChanged}
          onClick={() => void deathRoll.save()}
        >
          {deathRoll.isSaving ? "Saving…" : "Save"}
        </Button>
      </SettingRow>
      <SettingRow
        label="Level-ups"
        error={levelUps.errors.save}
        below={
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 min-[961px]:grid-cols-2">
              <ThresholdField
                id="settings-hero-thresholds"
                label="Heroes"
                value={levelUps.heroText}
                placeholder="2, 4, 6, 8, 11, 14…"
                error={levelUps.errors.hero}
                onChange={levelUps.setHeroText}
                onReset={levelUps.resetHero}
              />
              <ThresholdField
                id="settings-henchmen-thresholds"
                label="Henchmen"
                value={levelUps.henchmenText}
                placeholder="2, 5, 9, 14"
                error={levelUps.errors.henchmen}
                onChange={levelUps.setHenchmenText}
                onReset={levelUps.resetHenchmen}
              />
              {/* William, 7 Nov 2026: "hired sword max level up options in settings (exp points
                  and max)"; 12 Nov 2026: "like henchmen so get the same levels and gaps as them" */}
              <ThresholdField
                id="settings-hired-sword-thresholds"
                label="Hired swords"
                value={levelUps.hiredSwordText}
                placeholder="2, 5, 9, 14"
                error={levelUps.errors.hiredSword}
                onChange={levelUps.setHiredSwordText}
                onReset={levelUps.resetHiredSword}
              />
            </div>
            {/* the buttons take the row under the fields, not the grid's last cell (William, 12
                Nov 2026: "in a 2x2 grid with the buttons in their own row underneath") */}
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <Button
                variant="secondary"
                disabled={levelUps.isSaving}
                onClick={() => void levelUps.save()}
              >
                {levelUps.isSaving ? "Saving…" : "Save level-ups"}
              </Button>
            </div>
          </div>
        }
      />
    </SettingsCard>
  );
}
