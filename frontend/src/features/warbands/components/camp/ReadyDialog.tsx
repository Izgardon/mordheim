import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { readySummary } from "./camp-state";
import type { OpenCamp } from "./camp-types";

/**
 * Ready up (design E): the headline results (deaths, advances, injuries, gold, shards), then
 * Ready, which finalises the post-game: the Aftermath's draft is applied to the warband.
 */
export default function ReadyDialog({
  camp,
  open,
  onClose,
}: {
  camp: OpenCamp;
  open: boolean;
  onClose: () => void;
}) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { postgame } = camp;
  const error = postgame.drafting.draftError;
  const summary = open ? readySummary(camp) : [];

  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => (next ? null : onClose())}
      kicker="After the battle"
      title="Ready for the next battle?"
      footer={
        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={onClose}>
            Not yet
          </Button>
          <Button
            className="min-h-12"
            disabled={!postgame.ready || postgame.isFinalizing || postgame.drafting.isSavingDraft}
            onClick={() => void postgame.finalize().then((done) => (done ? onClose() : undefined))}
          >
            {postgame.isFinalizing ? "Getting ready…" : "Ready"}
          </Button>
        </div>
      }
    >
      <dl className="m-0 flex flex-col">
        {summary.map((line) => (
          <div
            key={line.k}
            className={cn(
              "border-t border-line py-[9px]",
              isMobile ? "flex flex-col gap-0.5" : "grid grid-cols-[110px_minmax(0,1fr)] gap-3"
            )}
          >
            <dt className="pt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              {line.k}
            </dt>
            <dd className="m-0 text-sm text-ink">{line.v}</dd>
          </div>
        ))}
      </dl>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
