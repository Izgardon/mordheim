import { Button } from "@/components/ui/button";

import {
  henchmenThresholds,
  heroThresholds,
  useLevelUpsForm,
} from "../../hooks/settings/useLevelUpsForm";
import type { CampaignSummary } from "../../types/campaign-types";
import SettingsDisclosure from "./SettingsDisclosure";
import { levelUpsSummary } from "./settings-summaries";
import { Field, FormError, TEXTAREA } from "./settings-ui";

/** A threshold list's field with its Reset default. */
function ThresholdField(props: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  error: string;
  onChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <Field label={props.label} htmlFor={props.id}>
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
 * Settings → Rules → Level-ups (`edit_settings`): the XP at which heroes, henchmen and hired swords
 * level up (William, 7 Nov 2026: "hired sword max level up options in settings"), saved together.
 */
export default function LevelUps({ campaign }: { campaign: CampaignSummary }) {
  const levelUps = useLevelUpsForm(campaign);
  const summary = levelUpsSummary(
    heroThresholds(campaign.hero_level_thresholds),
    henchmenThresholds(campaign.henchmen_level_thresholds),
    henchmenThresholds(campaign.hired_sword_level_thresholds)
  );
  return (
    <SettingsDisclosure title="Level-ups" summary={summary}>
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
        {/* William, 12 Nov 2026: hired swords "like henchmen so get the same levels and gaps" */}
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
      {/* the buttons take the row under the fields, not the grid's last cell (William, 12 Nov
          2026: "in a 2x2 grid with the buttons in their own row underneath") */}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button
          variant="secondary"
          disabled={levelUps.isSaving}
          onClick={() => void levelUps.save()}
        >
          {levelUps.isSaving ? "Saving…" : "Save level-ups"}
        </Button>
      </div>
      <FormError message={levelUps.errors.save} />
    </SettingsDisclosure>
  );
}
