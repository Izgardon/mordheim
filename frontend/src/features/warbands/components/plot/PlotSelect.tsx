import { SearchSelect } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { useCampaignPlots } from "@/features/plots/api/plots-queries";

import { plotOption } from "./plot-option";

/**
 * The plot a warband follows, picked from the campaign's list (apps/plots): one or none, changed
 * as often as the player likes for nothing. Every option carries the plot's own words on who may
 * follow it under its name (`plotOption`), so the player chooses without picking one to find
 * out, and the plot picked says them again in full underneath.
 */
export default function PlotSelect({
  campaignId,
  value,
  onChange,
  id,
}: {
  campaignId: number;
  value: number | null;
  onChange: (plotId: number | null) => void;
  id?: string;
}) {
  const offered = useCampaignPlots(campaignId);
  const settings = useSettingsById();
  const rows = offered.data ?? [];
  const picked = rows.find((row) => row.id === value);

  return (
    // a width, never a height: in a column (Raise a warband's form) `basis` would leave a tall
    // empty block under the field (William, 20 Nov 2026: "big gap between plot and warband list
    // summary")
    <div className="flex w-full min-w-0 max-w-[340px] flex-col gap-1">
      <SearchSelect
        id={id}
        label="Plot"
        placeholder="Search plots"
        emptyText="No plot matches."
        loading={offered.isLoading}
        options={rows.map((row) => plotOption(row, settings))}
        // the field keeps the name alone: the plot picked says who may follow it underneath
        value={picked ? { id: picked.id, title: picked.name } : null}
        clearLabel="No plot"
        oneLine
        onChange={(option) => onChange(option ? Number(option.id) : null)}
      />
      {picked?.who_text ? <p className="m-0 text-xs text-text2">{picked.who_text}</p> : null}
    </div>
  );
}
