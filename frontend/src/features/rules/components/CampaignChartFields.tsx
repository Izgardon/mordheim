import { useId } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@components/button";
import { IconButton } from "@components/icon-button";
import { Input } from "@components/input";

import { CHART_DICE, type CampaignChartPayload, type CampaignChartRow } from "../types/rule-types";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const AREA =
  "w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const BLANK_ROW: CampaignChartRow = { result: "", name: "", text: "" };

/** A chart's title, when it is rolled, its dice, its note and a row per result. */
export default function CampaignChartFields({
  value,
  onChange,
}: {
  value: CampaignChartPayload;
  onChange: (value: CampaignChartPayload) => void;
}) {
  const id = useId();
  const setRow = (index: number, row: Partial<CampaignChartRow>) =>
    onChange({
      ...value,
      rows: value.rows.map((entry, place) => (place === index ? { ...entry, ...row } : entry)),
    });
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
      <fieldset className="m-0 border-0 p-0">
        <legend className={LABEL}>Results</legend>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {value.rows.map((row, index) => (
            <li key={index} className="flex flex-wrap items-start gap-2">
              <Input
                aria-label={`Result ${index + 1} roll`}
                placeholder="3-4"
                maxLength={20}
                className="w-20"
                value={row.result}
                onChange={(event) => setRow(index, { result: event.target.value })}
              />
              <Input
                aria-label={`Result ${index + 1} name`}
                placeholder="Name"
                maxLength={160}
                className="min-w-[140px] flex-1"
                value={row.name}
                onChange={(event) => setRow(index, { name: event.target.value })}
              />
              <textarea
                aria-label={`Result ${index + 1} effect`}
                className={`${AREA} min-h-10 min-w-[200px] flex-[2]`}
                maxLength={4000}
                value={row.text}
                onChange={(event) => setRow(index, { text: event.target.value })}
              />
              <IconButton
                aria-label={`Remove result ${index + 1}`}
                onClick={() =>
                  onChange({ ...value, rows: value.rows.filter((_row, place) => place !== index) })
                }
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => onChange({ ...value, rows: [...value.rows, { ...BLANK_ROW }] })}
        >
          Add a result
        </Button>
      </fieldset>
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
