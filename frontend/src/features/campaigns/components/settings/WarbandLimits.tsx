import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

import { usePresetLocks } from "../../api/preset-queries";
import { useWarbandLimitsForm } from "../../hooks/settings/useWarbandLimitsForm";
import type { CampaignHeroDeathRoll, CampaignSummary } from "../../types/campaign-types";
import PresetNote, { presetDim } from "./PresetNote";
import SettingsDisclosure, { departuresFor } from "./SettingsDisclosure";
import { warbandsSummary } from "./settings-summaries";
import { SettingRow } from "./settings-ui";
import StartingGold from "./StartingGold";

const DEATH_ROLLS: { id: CampaignHeroDeathRoll; label: string }[] = [
  { id: "d66", label: "D66" },
  { id: "d100", label: "D100" },
];

/**
 * Settings → Rules → Warbands (`edit_settings`): the starting gold, the most heroes and hired
 * swords, and the table a hero's death is rolled on. Each saves on its own; a limit the campaign's
 * preset sets is greyed, still operable, and warns once departed from.
 */
export default function WarbandLimits({ campaign }: { campaign: CampaignSummary }) {
  const { limits, deathRoll } = useWarbandLimitsForm(campaign);
  const locks = usePresetLocks(campaign.id);
  return (
    <SettingsDisclosure
      title="Warbands"
      summary={warbandsSummary(campaign)}
      warnings={departuresFor(locks.departures, ["max_heroes", "hero_death_roll"])}
    >
      <StartingGold campaign={campaign} />
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
    </SettingsDisclosure>
  );
}
