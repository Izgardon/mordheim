import { ModalSheet } from "@/components/ui/modal-sheet";
import { PlotTrack } from "@/components/ui/plot-track";
import { cn } from "@/lib/utils";

import type { WarbandPlot } from "../../types/warband-types";

const HEADING = "m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/**
 * The plot's own plan, read only (William, 20 Nov 2026: Plot Details, "the plot rule that
 * currently sits in warband rules but not editable anymore and if possible better
 * formatted/layed out with the clear sections"): its summary, what it scores and its whole ladder
 * from the start, with the rungs the warband has reached marked. Every line is the server's
 * (`plots/selectors.py: warband_plot`, worded in `plots/wording.py`).
 */
export default function PlotDetailsDialog({
  plot,
  total,
  open,
  onOpenChange,
}: {
  plot: WarbandPlot;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { scoring, achievements: ladder } = plot;
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Plot"
      title={plot.name}
      description="What this plot scores and what its achievements give."
      className="max-w-[640px]"
      closeButton
    >
      {plot.summary ? (
        <p className="m-0 whitespace-pre-line text-sm text-ink">{plot.summary}</p>
      ) : null}
      <PlotTrack total={total} rungs={plot.rungs} />
      {scoring.length ? (
        <section className="flex flex-col gap-1.5">
          <h3 className={HEADING}>Campaign points</h3>
          <dl className="m-0 flex flex-col">
            {scoring.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-t border-line py-2"
              >
                <dt className="m-0 font-mono text-sm font-bold text-accent-text">{line.shown}</dt>
                <dd className="m-0 text-sm text-ink">{line.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {ladder.length ? (
        <section className="flex flex-col gap-1.5">
          <h3 className={HEADING}>Achievements</h3>
          <dl className="m-0 flex flex-col">
            {ladder.map((rung, index) => {
              const reached = rung.points <= total;
              return (
                <div
                  key={index}
                  className={cn(
                    "grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-t border-line py-2",
                    reached && "bg-accent-soft"
                  )}
                >
                  <dt
                    className={cn(
                      "m-0 font-mono text-sm font-bold",
                      reached ? "text-accent-hi" : "text-text2"
                    )}
                  >
                    {rung.points} CP
                  </dt>
                  <dd className="m-0 flex flex-col gap-0.5">
                    {rung.name ? (
                      <span className="text-sm font-bold text-head">{rung.name}</span>
                    ) : null}
                    {rung.text ? <span className="text-sm text-ink">{rung.text}</span> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ) : null}
    </ModalSheet>
  );
}
