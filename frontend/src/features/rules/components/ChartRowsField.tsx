import { Trash2 } from "lucide-react";

import { Button } from "@components/button";
import { IconButton } from "@components/icon-button";
import { Input } from "@components/input";

import type { CampaignChartRow } from "../types/rule-types";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const AREA =
  "w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const BLANK: CampaignChartRow = { result: "", name: "", text: "" };

/** A table's results, edited in place: what was rolled, its name and what it does. Shared by the
 * chart form and a rule's own table, so there is one way to write a table. */
export default function ChartRowsField({
  rows,
  onChange,
}: {
  rows: CampaignChartRow[];
  onChange: (rows: CampaignChartRow[]) => void;
}) {
  const setRow = (index: number, patch: Partial<CampaignChartRow>) =>
    onChange(rows.map((row, place) => (place === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={LABEL}>Results</legend>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {rows.map((row, index) => (
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
              onClick={() => onChange(rows.filter((_row, place) => place !== index))}
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
        onClick={() => onChange([...rows, { ...BLANK }])}
      >
        Add a result
      </Button>
    </fieldset>
  );
}
