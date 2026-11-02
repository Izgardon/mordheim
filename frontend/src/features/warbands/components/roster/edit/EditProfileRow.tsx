import { useId } from "react";

import { Input } from "@/components/ui/input";
import { STAT_KEYS } from "@/components/ui/stat-strip";
import { Switch } from "@/components/ui/switch";

import { STAT_FIELDS, type UnitEditDraft } from "./useUnitEditDraft";

const LABEL = "text-xs font-bold text-muted-foreground";

/**
 * The edit form's experience and profile on one row: XP with half rate as a thin toggle in its
 * label line, then the stat line as small boxes (an empty one saves as 0).
 */
export default function EditProfileRow({
  form,
  unitLabel,
}: {
  form: UnitEditDraft;
  /** The unit's name, for the boxes' labels. */
  unitLabel: string;
}) {
  const { draft, set } = form;
  const xpId = useId();
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="flex w-full flex-col gap-1 min-[520px]:w-44">
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
        <Input
          id={xpId}
          inputSize="sm"
          inputMode="numeric"
          className="font-mono"
          value={String(draft.xp ?? "")}
          onChange={(event) => set("xp", event.target.value)}
        />
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
        <legend className={`${LABEL} pb-1`}>Profile</legend>
        <div className="grid grid-cols-5 gap-1 min-[520px]:flex">
          {STAT_KEYS.map((key) => (
            <label
              key={key}
              className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-faint"
            >
              {key}
              <Input
                inputSize="sm"
                inputMode="numeric"
                aria-label={`${key} for ${unitLabel}`}
                className="h-8 w-full px-0 text-center font-mono text-sm md:h-8 min-[520px]:w-10"
                value={String(draft[STAT_FIELDS[key]] ?? "")}
                onChange={(event) => set(STAT_FIELDS[key], event.target.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
