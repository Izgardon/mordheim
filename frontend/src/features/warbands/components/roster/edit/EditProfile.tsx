import { useId } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { StatBoxes } from "@/components/ui/stat-boxes";
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

/** The ten boxes: each label's field ("WS": weapon_skill), the save last. */
const PROFILE_BOXES = STAT_KEYS.map((key) => ({ key: STAT_FIELDS[key], label: key }));

/**
 * The profile as type boxes (an empty one saves as 0): each characteristic a number or the value
 * as the book writes it ("1(2)", "D6", "-"), which the server reads, and the save.
 */
export default function EditProfile({
  form,
  unitLabel,
}: {
  form: UnitEditDraft;
  /** The unit's name, for the boxes' labels. */
  unitLabel: string;
}) {
  const { draft, set } = form;
  const values = Object.fromEntries(
    PROFILE_BOXES.map(({ key }) => [key, String(draft[key] ?? "")])
  );
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className={`${LABEL} pb-1`}>Profile</legend>
      <StatBoxes
        fields={PROFILE_BOXES}
        values={values}
        name={(stat) => `${stat} for ${unitLabel}`}
        onChange={(patch) => {
          for (const [key, value] of Object.entries(patch)) set(key, value);
        }}
      />
    </fieldset>
  );
}
