import { useId } from "react";

import { Input } from "@components/input";

import { CHART_DICE, type CampaignChartPayload } from "../types/rule-types";
import ChartRowsField from "./ChartRowsField";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const AREA =
  "w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** A chart's title, when it is rolled, its dice, its note and a row per result. */
export default function CampaignChartFields({
  value,
  onChange,
}: {
  value: CampaignChartPayload;
  onChange: (value: CampaignChartPayload) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <label htmlFor={`${id}-title`} className={LABEL}>
            Title
          </label>
          <Input
            id={`${id}-title`}
            maxLength={160}
            value={value.title}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-dice`} className={LABEL}>
            Dice
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
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-umbrella`} className={LABEL}>
          Umbrella
        </label>
        <Input
          id={`${id}-umbrella`}
          maxLength={120}
          placeholder="Monster encounters"
          value={value.umbrella ?? ""}
          onChange={(event) => onChange({ ...value, umbrella: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-description`} className={LABEL}>
          When it is rolled
        </label>
        <textarea
          id={`${id}-description`}
          className={`${AREA} min-h-[72px]`}
          maxLength={2000}
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </div>
      <ChartRowsField rows={value.rows} onChange={(rows) => onChange({ ...value, rows })} />
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-note`} className={LABEL}>
          Note
        </label>
        <textarea
          id={`${id}-note`}
          className={`${AREA} min-h-[72px]`}
          maxLength={2000}
          placeholder="The modifiers, and what a result sends the player on to."
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
        />
      </div>
    </div>
  );
}
