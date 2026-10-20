import { Button } from "@components/button";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";

import type { useWarbandRulesForm } from "../../hooks/settings/useWarbandRulesForm";
import type { CampaignHeroDeathRoll } from "../../types/campaign-types";

type Form = ReturnType<typeof useWarbandRulesForm>;

/** Max heroes and max hired swords, saved together. */
export function WarbandLimitsField({ limits }: { limits: Form["limits"] }) {
  return (
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
              value={limits.maxHeroes}
              onChange={(event) => limits.setMaxHeroes(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Max hired swords
            </Label>
            <NumberInput
              min={0}
              placeholder="0"
              value={limits.maxHiredSwords}
              onChange={(event) => limits.setMaxHiredSwords(event.target.value)}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={limits.save}
          disabled={limits.isSaving || !limits.hasChanged}
          className="self-end sm:ml-auto"
        >
          {limits.isSaving ? "Saving" : "Save"}
        </Button>
      </div>
      <p className="min-h-[1.25rem] text-sm text-red-600">{limits.error}</p>
    </div>
  );
}

/** Which table a hero's death is rolled on. */
export function HeroDeathRollField({ deathRoll }: { deathRoll: Form["deathRoll"] }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">Hero death roll table</Label>
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div className="space-y-1">
          <select
            value={deathRoll.value}
            onChange={(event) => deathRoll.setValue(event.target.value as CampaignHeroDeathRoll)}
            className="h-9 min-w-30 rounded-md border border-border/60 bg-background/70 px-3 text-sm text-foreground"
          >
            <option value="d66">D66</option>
            <option value="d100">D100</option>
          </select>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={deathRoll.save}
          disabled={deathRoll.isSaving || !deathRoll.hasChanged}
          className="self-end"
        >
          {deathRoll.isSaving ? "Saving" : "Save"}
        </Button>
      </div>
      <p className="min-h-[1.25rem] text-sm text-red-600">{deathRoll.error}</p>
    </div>
  );
}
