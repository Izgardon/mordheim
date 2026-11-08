import { useEffect, useState } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { useWarbandRulesForm } from "../../hooks/settings/useWarbandRulesForm";
import type { CampaignHeroDeathRoll, CampaignSummary } from "../../types/campaign-types";
import { useCampaignSave } from "./CampaignSection";
import DefaultResource from "./DefaultResource";
import { Field, FormError, SettingRow, SettingsCard, TEXTAREA } from "./settings-ui";
import WyrdstonePrices from "./WyrdstonePrices";

/** A warband's sheet, summary or treasury in this campaign: what a gold adjustment changes. */
const isWarbandGoldQuery = (campaignId: number) => (query: Query) => {
  const [scope, id, kind, warbandId, part] = query.queryKey;
  return (
    scope === "campaign" &&
    id === campaignId &&
    kind === "warband" &&
    typeof warbandId === "number" &&
    (part === "sheet" || part === "summary" || part === "treasury")
  );
};

const signedGold = (amount: number) => `${amount > 0 ? "+" : ""}${amount} gc`;
const NUMBER_FIELD = "w-[110px] font-mono";

/**
 * The starting gold (decision 6, BUG-78). A change asks whether existing warbands get the
 * difference, ticked before the campaign starts and unticked after; the server writes one
 * Adjustment per warband, and their sheets and treasuries are read again.
 */
function StartingGold({ campaign }: { campaign: CampaignSummary }) {
  const queryClient = useQueryClient();
  const current = campaign.starting_gold ?? 500;
  const [value, setValue] = useState(String(current));
  const [confirming, setConfirming] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const { saving, error, setError, save } = useCampaignSave(
    campaign.id,
    "Couldn't save the starting gold."
  );
  useEffect(() => setValue(String(current)), [current]);
  const amount = Number(value);
  const difference = amount - current;

  const ask = () => {
    if (value.trim() === "" || !Number.isInteger(amount) || amount < 0) {
      setError("Enter the starting gold in whole crowns.");
      return;
    }
    setError("");
    setAdjust(!campaign.in_progress);
    setConfirming(true);
  };
  const submit = async () => {
    if (await save({ starting_gold: amount, adjust_existing_warbands: adjust })) {
      setConfirming(false);
      if (adjust)
        void queryClient.invalidateQueries({ predicate: isWarbandGoldQuery(campaign.id) });
    }
  };

  return (
    <SettingRow label="Starting gold" error={confirming ? "" : error}>
      <NumberInput
        min={0}
        aria-label="Starting gold"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={NUMBER_FIELD}
      />
      <span className="text-sm text-text2">gc</span>
      <Button variant="secondary" disabled={saving || amount === current} onClick={ask}>
        Save
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Change the starting gold"
        description={
          <div className="flex flex-col gap-3">
            <p className="m-0 text-ink">{`Change the starting gold from ${current} to ${amount} gc?`}</p>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Checkbox
                checked={adjust}
                disabled={saving}
                onChange={(event) => setAdjust(event.target.checked)}
              />
              {`Adjust the warbands already raised by ${signedGold(difference)}`}
            </label>
            <p className="m-0 text-xs">
              {adjust
                ? `Each warband gets an Adjustment of ${signedGold(difference)} in its treasury.`
                : `The warbands already raised keep their gold; only new ones start with ${amount} gc.`}
            </p>
          </div>
        }
        error={error}
        confirmText={saving ? "Saving…" : "Save the starting gold"}
        confirmVariant="primary"
        isConfirming={saving}
        onConfirm={() => void submit()}
      />
    </SettingRow>
  );
}

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
 * drafts.
 */
export default function CampaignRules({ campaign }: { campaign: CampaignSummary }) {
  const { limits, deathRoll, levelUps } = useWarbandRulesForm(campaign);
  return (
    <SettingsCard title="Warband rules">
      <StartingGold campaign={campaign} />
      <DefaultResource campaign={campaign} />
      <WyrdstonePrices campaign={campaign} />
      <SettingRow label="Warband limits" error={limits.error}>
        <label className="flex items-center gap-2 text-sm text-text2">
          Heroes
          <NumberInput
            compact
            min={0}
            aria-label="Most heroes"
            value={limits.maxHeroes}
            onChange={(event) => limits.setMaxHeroes(event.target.value)}
            className="w-[80px] font-mono"
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
      <SettingRow label="Hero death roll" error={deathRoll.error}>
        <div role="group" aria-label="Hero death roll" className="flex gap-1.5">
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
                and max)"; "just like the hero and henchman one does" */}
            <ThresholdField
              id="settings-hired-sword-thresholds"
              label="Hired swords"
              value={levelUps.hiredSwordText}
              placeholder="2, 4, 6, 8, 11, 14…"
              error={levelUps.errors.hiredSword}
              onChange={levelUps.setHiredSwordText}
              onReset={levelUps.resetHiredSword}
            />
            <Button
              variant="secondary"
              className="self-start"
              disabled={levelUps.isSaving}
              onClick={() => void levelUps.save()}
            >
              {levelUps.isSaving ? "Saving…" : "Save level-ups"}
            </Button>
          </div>
        }
      />
    </SettingsCard>
  );
}
