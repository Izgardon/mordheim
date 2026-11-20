import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { useCampaignPlots } from "@/features/plots/api/plots-queries";
import type { PlotRow } from "@/features/plots/types/plot-types";

const plotOption = (plot: PlotRow): SearchOption => ({
  id: plot.id,
  title: plot.name,
  subtitle: plot.who_text,
});

/**
 * The plot a warband follows, picked from the campaign's list (apps/plots): one or none, changed
 * as often as the player likes for nothing. Every option carries the plot's own words on who may
 * follow it under its name (William, 18 Nov 2026: "options should have title of name and
 * subtitles of who can take it"), so the player chooses without picking one to find out, and the
 * plot picked says them again in full underneath. Nothing is matched to warband types, greyed or
 * warned about (`Plot.who_text`).
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
        options={rows.map(plotOption)}
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
