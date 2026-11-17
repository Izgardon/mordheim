import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandPlot } from "../../api/plot-queries";
import type { WarbandPlot } from "../../types/warband-types";
import PlotSelect from "./PlotSelect";
import PlotTrack from "./PlotTrack";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/**
 * Campaign points and the plot the warband follows (apps/plots), shown while the campaign has
 * Plots on: the track, the total the player types (nothing here computes, adds to or takes from
 * it), and one plot of the campaign's, changed for nothing (William: "editable for free").
 *
 * The plot's rules are the server's (`warbands/services/plot_rules.py`) and show as the warband's
 * rule pills: the plot's own rule with its whole ladder, and one rule per rung reached.
 */
export default function WarbandPlotSection({
  campaignId,
  warbandId,
  plot,
  total,
  canEdit,
}: {
  campaignId: number;
  warbandId: number;
  /** The plot it follows, with its ladder, from the sheet; null: none. */
  plot: WarbandPlot | null;
  total: number;
  canEdit: boolean;
}) {
  const save = useWarbandPlot(campaignId, warbandId);
  const [typed, setTyped] = useState(String(total));
  useEffect(() => setTyped(String(total)), [total]);
  // the plot shown while the sheet that holds it is read again
  const [picked, setPicked] = useState(plot?.id ?? null);
  useEffect(() => setPicked(plot?.id ?? null), [plot?.id]);
  const onError = (error: unknown) => toast.error(getErrorMessage(error, "Couldn't save that."));

  const saveTotal = () => {
    const next = Math.max(0, Math.trunc(Number(typed) || 0));
    setTyped(String(next));
    if (next !== total) save.mutate({ campaign_points: next }, { onError });
  };

  return (
    <section
      aria-label="Campaign points"
      className="flex flex-col gap-2.5 border-y border-line py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={LABEL}>Campaign points</span>
        {canEdit ? (
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            aria-label="Campaign points"
            className="h-9 w-20 font-mono md:h-9"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={saveTotal}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        ) : (
          <span className="font-display text-2xl font-semibold text-head">{total}</span>
        )}
        <span className={LABEL}>Plot</span>
        {canEdit ? (
          <PlotSelect
            campaignId={campaignId}
            value={picked}
            onChange={(plotId) => {
              setPicked(plotId);
              save.mutate({ plot_id: plotId }, { onError });
            }}
          />
        ) : (
          <span className="text-[13px] text-ink">{plot?.name ?? "None"}</span>
        )}
      </div>
      <PlotTrack total={total} rungs={plot?.rungs ?? []} />
    </section>
  );
}
