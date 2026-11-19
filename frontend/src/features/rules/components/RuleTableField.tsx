import { useId } from "react";

import { Button } from "@components/button";

import { CHART_DICE, type RuleTable } from "../types/rule-types";
import ChartRowsField from "./ChartRowsField";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const AREA =
  "w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const BLANK: RuleTable = {
  dice: "D6",
  description: "",
  note: "",
  rows: [{ result: "", name: "", text: "" }],
};

/**
 * A rule's own table (William, 20 Nov 2026): the dice it is rolled on and a row per result, shown
 * inside the rule rather than in the Charts list, which is for the reference charts a player looks
 * up. A rule has none until one is added here.
 */
export default function RuleTableField({
  value,
  onChange,
}: {
  value: RuleTable | null | undefined;
  onChange: (table: RuleTable | null) => void;
}) {
  const id = useId();
  if (!value) {
    return (
      <Button size="sm" variant="secondary" onClick={() => onChange({ ...BLANK })}>
        Add a table
      </Button>
    );
  }
  return (
    <div className="space-y-3 border border-line p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-dice`} className={LABEL}>
            Table
          </label>
          <select
            id={`${id}-dice`}
            className="min-h-10 border border-strong bg-page px-2 text-sm text-ink"
            value={value.dice}
            onChange={(event) => onChange({ ...value, dice: event.target.value })}
          >
            <option value="">No dice</option>
            {CHART_DICE.map((die) => (
              <option key={die} value={die}>
                {die}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Remove the table
        </Button>
      </div>
      <ChartRowsField rows={value.rows} onChange={(rows) => onChange({ ...value, rows })} />
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-note`} className={LABEL}>
          Note
        </label>
        <textarea
          id={`${id}-note`}
          className={`${AREA} min-h-[60px]`}
          maxLength={2000}
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
        />
      </div>
    </div>
  );
}
