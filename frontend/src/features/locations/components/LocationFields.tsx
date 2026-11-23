import { useId } from "react";

import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CampaignChart } from "@/features/rules/types/rule-types";

import type { HeroCount, LocationGroup, LocationPayload } from "../types";
import { AREA, LABEL } from "./form-styles";

const COUNTS = Array.from({ length: 12 }, (_value, index) => index + 1);
const SELECT = "min-h-10 border border-strong bg-page px-2 text-sm text-ink";

/** "all" or a number, as the select spells it. */
const countOf = (value: string): HeroCount => (value === "all" ? "all" : Number(value));

/** A location's own fields: name, group, rules, how many heroes go, the trading action and the
 * campaign tables it points to. */
export default function LocationFields({
  value,
  onChange,
  groups,
  charts,
}: {
  value: LocationPayload;
  onChange: (value: LocationPayload) => void;
  groups: LocationGroup[];
  charts: CampaignChart[];
}) {
  const id = useId();
  const set = (patch: Partial<LocationPayload>) => onChange({ ...value, ...patch });
  const count = (key: "min_heroes" | "max_heroes", label: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-${key}`} className={LABEL}>
        {label}
      </label>
      <select
        id={`${id}-${key}`}
        className={SELECT}
        value={String(value[key])}
        onChange={(event) => set({ [key]: countOf(event.target.value) })}
      >
        {COUNTS.map((number) => (
          <option key={number} value={number}>
            {number}
          </option>
        ))}
        <option value="all">All</option>
      </select>
    </div>
  );
  const linked = (chartId: number) => value.chart_ids.includes(chartId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <label htmlFor={`${id}-name`} className={LABEL}>
            Name
          </label>
          <Input
            id={`${id}-name`}
            maxLength={160}
            value={value.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-group`} className={LABEL}>
            Group
          </label>
          <select
            id={`${id}-group`}
            className={SELECT}
            value={value.group_id}
            onChange={(event) => set({ group_id: Number(event.target.value) })}
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-rules`} className={LABEL}>
          Rules
        </label>
        <textarea
          id={`${id}-rules`}
          className={`${AREA} min-h-[120px]`}
          maxLength={8000}
          value={value.rules}
          onChange={(event) => set({ rules: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {count("min_heroes", "Fewest heroes")}
        {count("max_heroes", "Most heroes")}
        <Switch
          checked={value.takes_trading_action}
          onCheckedChange={(on) => set({ takes_trading_action: on })}
        >
          Takes the trading action
        </Switch>
      </div>
      {charts.length ? (
        <div role="group" aria-label="Campaign charts it points to" className="flex flex-col gap-2">
          <span className={LABEL}>Campaign charts it points to</span>
          <div className="flex flex-wrap gap-1.5">
            {charts.map((chart) => (
              <Chip
                key={chart.id}
                pressed={linked(chart.id)}
                onClick={() =>
                  set({
                    chart_ids: linked(chart.id)
                      ? value.chart_ids.filter((entry) => entry !== chart.id)
                      : [...value.chart_ids, chart.id],
                  })
                }
              >
                {chart.title}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
