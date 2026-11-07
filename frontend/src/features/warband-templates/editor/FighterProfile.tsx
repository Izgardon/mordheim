import { StatBoxes } from "@/components/ui/stat-boxes";
import { STAT_FIELDS, type StatInputs } from "@/features/catalogue/utils/statblock";

import { CAPTION } from "./editor-ui";

/**
 * His profile as type boxes, each a number or the value as the book writes it ("1(2)", "D6",
 * "-"), as every other profile form takes it.
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
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className={`${CAPTION} pb-1`}>Profile</legend>
      <StatBoxes
        fields={STAT_FIELDS}
        values={stats}
        name={(stat) => `${stat} for ${label}`}
        onChange={(patch) => onChange({ ...stats, ...patch })}
      />
    </fieldset>
  );
}
