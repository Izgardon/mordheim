import { useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/icon-button";
import { PlotTrack } from "@/components/ui/plot-track";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandPlot } from "../../api/plot-queries";
import type { WarbandPlot } from "../../types/warband-types";
import { SECTION_TITLE } from "../page/warband-layout";
import PlotDetailsDialog from "./PlotDetailsDialog";

/**
 * Campaign points and the plot the warband follows (apps/plots), shown while the campaign has
 * Plots on. Collapsed it is one line, as a resource reads (William, 22 Nov 2026): the plot's
 * name, the total as a resource shows its amount with − and + (the player's own number: nothing
 * here computes, adds to or takes from it), and the arrow that opens the rest. Open, it shows Plot Details (the plot's own plan, read
 * only) and the track. The plot is picked in warband Settings only (William, 22 Nov 2026).
 *
 * Only the rungs the total has reached are warband rules (`warbands/services/plot_rules.py`); the
 * plan is this section's, not a rule (William, 20 Nov 2026).
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
  /** The plot it follows, whole, from the sheet; null: none. */
  plot: WarbandPlot | null;
  total: number;
  canEdit: boolean;
}) {
  const save = useWarbandPlot(campaignId, warbandId);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const onError = (error: unknown) => toast.error(getErrorMessage(error, "Couldn't save that."));

  const write = (next: number) => {
    const points = Math.max(0, Math.trunc(next || 0));
    if (points !== total) save.mutate({ campaign_points: points }, { onError });
  };

  return (
    <section aria-label="Campaign points" className="flex flex-col gap-2 border-b border-line pb-3">
      <h2 className={SECTION_TITLE}>Campaign points</h2>
      <div className="flex items-center justify-between gap-2 whitespace-nowrap py-1">
        <span className="min-w-0 truncate text-[13px] font-bold text-ink">
          {plot?.name ?? "No plot"}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {canEdit ? (
            <IconButton
              aria-label="One campaign point less"
              className="h-8 w-8"
              onClick={() => write(total - 1)}
            >
              <Minus aria-hidden="true" />
            </IconButton>
          ) : null}
          <span className="min-w-[26px] text-center font-display text-2xl font-semibold text-head">
            {total}
          </span>
          {canEdit ? (
            <IconButton
              aria-label="One campaign point more"
              className="h-8 w-8"
              onClick={() => write(total + 1)}
            >
              <Plus aria-hidden="true" />
            </IconButton>
          ) : null}
          <IconButton
            aria-label={open ? "Hide the plot" : "Show the plot"}
            aria-expanded={open}
            look="plain"
            className="h-8 w-8"
            onClick={() => setOpen(!open)}
          >
            <ChevronDown
              aria-hidden="true"
              className={open ? "rotate-180 transition-transform" : "transition-transform"}
            />
          </IconButton>
        </span>
      </div>
      {open ? (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setDetails(true)}
            disabled={!plot}
            className="min-h-9 self-start border border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised disabled:opacity-50"
          >
            Plot details
          </button>
          <PlotTrack total={total} rungs={plot?.rungs ?? []} />
        </div>
      ) : null}
      {plot ? (
        <PlotDetailsDialog plot={plot} total={total} open={details} onOpenChange={setDetails} />
      ) : null}
    </section>
  );
}
