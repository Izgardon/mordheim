import { Button } from "@components/button";
import CampaignChartFields from "@/features/rules/components/CampaignChartFields";

import type { LocationTablePayload } from "../types";
import { LABEL } from "./form-styles";

export const BLANK_TABLE: LocationTablePayload = {
  title: "",
  description: "",
  dice: "D6",
  note: "",
  rows: [{ result: "", name: "", text: "" }],
};

/** A location's own tables, each written as a campaign table is; a result's own table rides along. */
export default function LocationTablesField({
  tables,
  onChange,
}: {
  tables: LocationTablePayload[];
  onChange: (tables: LocationTablePayload[]) => void;
}) {
  const set = (index: number, table: LocationTablePayload) =>
    onChange(tables.map((entry, place) => (place === index ? table : entry)));
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className={LABEL}>Its tables</legend>
      {tables.map((table, index) => (
        <div key={index} className="flex flex-col gap-3 border border-line p-3">
          <CampaignChartFields
            value={table}
            onChange={(next) => set(index, next)}
            umbrella={false}
          />
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => onChange(tables.filter((_entry, place) => place !== index))}
          >
            Remove {table.title.trim() || `table ${index + 1}`}
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        onClick={() => onChange([...tables, { ...BLANK_TABLE, rows: [...BLANK_TABLE.rows] }])}
      >
        Add a table
      </Button>
    </fieldset>
  );
}
