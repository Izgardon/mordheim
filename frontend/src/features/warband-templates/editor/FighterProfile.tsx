import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  isWritten,
  numberOnly,
  STAT_FIELDS,
  type StatInputs,
} from "@/features/catalogue/utils/statblock";

import { CAPTION } from "./editor-ui";

/**
 * His profile as small boxes: plain numbers, or with Written values on, the value as the book
 * writes it ("1(2)", "D6", "-"), as every other profile form does; turning it off keeps each
 * one's number.
 */
export default function FighterProfile({
  stats,
  label,
  onChange,
}: {
  stats: StatInputs;
  /** The fighter's name, for the boxes' labels. */
  label: string;
  onChange: (stats: StatInputs) => void;
}) {
  const [written, setWritten] = useState(() =>
    STAT_FIELDS.some(({ key }) => isWritten(stats[key]))
  );
  const writeNumbers = (on: boolean) => {
    if (!on) {
      onChange(
        Object.fromEntries(
          STAT_FIELDS.map(({ key }) => [key, numberOnly(stats[key])])
        ) as StatInputs
      );
    }
    setWritten(on);
  };
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className={`${CAPTION} pb-1`}>Profile</legend>
      <div className="grid grid-cols-5 gap-1 min-[520px]:grid-cols-9">
        {STAT_FIELDS.map(({ key, label: stat }) => (
          <label
            key={key}
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-faint"
          >
            {stat}
            <Input
              inputSize="sm"
              maxLength={8}
              inputMode={written ? "text" : "numeric"}
              aria-label={`${stat} for ${label}`}
              className="w-full px-0.5 text-center font-mono text-sm"
              value={stats[key]}
              onChange={(event) =>
                onChange({
                  ...stats,
                  [key]: written ? event.target.value : event.target.value.replace(/\D/g, ""),
                })
              }
            />
          </label>
        ))}
      </div>
      <Switch
        look="plain"
        className="min-h-5 self-start text-xs"
        checked={written}
        onCheckedChange={writeNumbers}
      >
        Written values
      </Switch>
    </fieldset>
  );
}
