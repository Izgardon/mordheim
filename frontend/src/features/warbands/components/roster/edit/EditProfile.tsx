import { useId } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { STAT_KEYS } from "@/components/ui/stat-strip";
import { Switch } from "@/components/ui/switch";

import { STAT_FIELDS, type UnitEditDraft } from "./useUnitEditDraft";

const LABEL = "text-xs font-bold text-muted-foreground";

/**
 * Experience on the form's first row: half rate as a thin toggle in its label line, the box as
 * tall as the row (its − and + step by ½ at half rate).
 */
export function EditXpField({ form }: { form: UnitEditDraft }) {
  const { draft, set } = form;
  const xpId = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={xpId} className={LABEL}>
          Experience
        </label>
        <Switch
          look="plain"
          className="min-h-5 text-xs"
          checked={Boolean(draft.half_rate)}
          onCheckedChange={(on) => set("half_rate", on)}
        >
          Half rate
        </Switch>
      </div>
      <NumberInput
        id={xpId}
        inputSize="sm"
        min={0}
        step={draft.half_rate ? 0.5 : 1}
        containerClassName="h-auto min-h-9 flex-1"
        value={String(draft.xp ?? "")}
        onChange={(event) => set("xp", event.target.value)}
      />
    </div>
  );
}

/** The profile as small boxes, each a vertical stepper (an empty one saves as 0). */
export default function EditProfile({
  form,
  unitLabel,
}: {
  form: UnitEditDraft;
  /** The unit's name, for the boxes' labels. */
  unitLabel: string;
}) {
  const { draft, set } = form;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className={`${LABEL} pb-1`}>Profile</legend>
      <div className="grid grid-cols-5 justify-items-start gap-1 min-[520px]:flex min-[520px]:flex-wrap">
        {STAT_KEYS.map((key) => (
          <label
            key={key}
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-faint"
          >
            {key}
            <NumberInput
              vertical
              inputSize="sm"
              min={0}
              max={10}
              aria-label={`${key} for ${unitLabel}`}
              className="text-sm"
              value={String(draft[STAT_FIELDS[key]] ?? "")}
              onChange={(event) => set(STAT_FIELDS[key], event.target.value)}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
