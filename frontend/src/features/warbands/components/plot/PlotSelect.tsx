import { useCampaignPlots } from "@/features/plots/api/plots-queries";

/**
 * The plot a warband follows, picked from the campaign's list (apps/plots): one or none, changed
 * as often as the player likes for nothing. Under it, the plot's own words on who may follow it,
 * which the player reads and decides on: nothing is matched to warband types, greyed or warned
 * about (`Plot.who_text`).
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
    <div className="flex min-w-[180px] max-w-[340px] flex-col gap-1">
      <select
        id={id}
        aria-label="Plot"
        className="h-9 w-full border border-strong bg-page px-1.5 text-[13px] text-ink"
        value={value === null ? "" : String(value)}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      >
        <option value="">No plot</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
      {picked?.who_text ? <p className="m-0 text-xs text-text2">{picked.who_text}</p> : null}
    </div>
  );
}
