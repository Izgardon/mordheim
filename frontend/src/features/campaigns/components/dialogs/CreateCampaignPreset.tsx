import type { CampaignPreset } from "../../types/campaign-types";
import { setsLine } from "../settings/campaign-preset";
import { Field } from "../settings/settings-ui";

type CreateCampaignPresetProps = {
  presets: CampaignPreset[];
  /** The preset picked, or undefined until the list has loaded. */
  picked: CampaignPreset | undefined;
  onPick: (preset: CampaignPreset) => void;
  disabled?: boolean;
};

/**
 * Campaign creation, at the top: which published campaign you are playing. One only, Mordheim to
 * begin with. Picking one applies what it dictates (the pages below take its values, greyed and
 * still yours to change) and ticks the settings it guides towards in the content in play.
 */
export default function CreateCampaignPreset({
  presets,
  picked,
  onPick,
  disabled,
}: CreateCampaignPresetProps) {
  const line = picked ? setsLine(picked.sets) : "";
  const ticks = picked?.setting_names.join(", ") ?? "";
  const rules = picked?.rule_count
    ? `copies its ${picked.rule_count} ${picked.rule_count === 1 ? "rule" : "rules"}`
    : "";
  // what picking it does besides the settings above: the content it ticks, and the rules it copies
  const adds = ticks
    ? `It ticks ${ticks} below${rules ? ` and ${rules}` : ""}.`
    : rules
      ? `It ${rules}.`
      : null;

  return (
    <Field
      label="Campaign"
      htmlFor="campaign-preset"
      hint={
        picked ? (
          <>
            {line ? `It sets ${line}.` : null}
            {line && adds ? " " : null}
            {adds}
          </>
        ) : undefined
      }
    >
      <select
        id="campaign-preset"
        value={picked?.id ?? ""}
        disabled={disabled || presets.length === 0}
        onChange={(event) => {
          const preset = presets.find((row) => row.id === Number(event.target.value));
          if (preset) onPick(preset);
        }}
        className="min-h-11 border border-strong bg-page px-2.5 text-sm text-ink"
      >
        {presets.length === 0 ? <option value="">Loading…</option> : null}
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
