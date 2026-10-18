import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { POSTBATTLE_SECTION_LABELS } from "@/features/battles/components/postbattle/PostbattleSection";
import type { FinalizeSummary } from "@/features/battles/components/postbattle/postbattle-summary";
import { HELPER_DIALOG_CONTENT_CLASS } from "@/features/battles/components/shared/battle-dialog-styles";

function SummaryPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="battle-inline-panel p-4">
      <p className="battle-section-title">{title}</p>
      {children}
    </div>
  );
}

function SummaryLines({
  lines,
  empty,
}: {
  lines: { key: string; text: ReactNode }[];
  empty: string;
}) {
  if (lines.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      {lines.map((line) => (
        <p key={line.key} className="text-sm text-foreground">
          {line.text}
        </p>
      ))}
    </div>
  );
}

/** Finalise Postbattle: the permanent changes finalising applies, then Confirm. */
export default function FinalizeSummaryDialog({
  open,
  onOpenChange,
  warbandName,
  summary,
  showUpkeep,
  error,
  confirmDisabled,
  isFinalizing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warbandName: string;
  summary: FinalizeSummary;
  showUpkeep: boolean;
  error: string;
  confirmDisabled: boolean;
  isFinalizing: boolean;
  onConfirm: () => void;
}) {
  const hasFinds = summary.findsGoldCrowns > 0 || summary.findsItems.length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Finalise Postbattle</DialogTitle>
          <DialogDescription>
            Review the permanent changes that will be applied to {warbandName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <SummaryPanel title={POSTBATTLE_SECTION_LABELS.exploration}>
            <p className="mt-2 text-sm text-foreground">
              {summary.resourceName ? (
                <>
                  You will gain {summary.resourceAmount}{" "}
                  <span className="text-accent">{summary.resourceName}</span>.
                </>
              ) : (
                "No resource will be updated."
              )}
            </p>
          </SummaryPanel>
          <SummaryPanel title={POSTBATTLE_SECTION_LABELS.finds}>
            <div className="mt-2 space-y-2">
              {summary.findsGoldCrowns > 0 ? (
                <p className="text-sm text-foreground">
                  {summary.findsGoldCrowns} gc will be added as a Reward trade.
                </p>
              ) : null}
              {summary.findsItems.length > 0 ? (
                <div className="space-y-2">
                  {summary.findsItems.map((item, index) => (
                    <p key={`${item.item_id}-${index}`} className="text-sm text-foreground">
                      {item.name} will be added to the stash
                      {item.cost !== null ? ` at ${item.cost} gc` : ""}.
                    </p>
                  ))}
                </div>
              ) : null}
              {!hasFinds ? (
                <p className="text-sm text-muted-foreground">No finds are currently set.</p>
              ) : null}
            </div>
          </SummaryPanel>
          <SummaryPanel title="Deaths">
            <SummaryLines
              lines={summary.deaths.map((row) => ({
                key: `death-${row.unitKey}`,
                text: `${row.unitName} will be marked dead.`,
              }))}
              empty="No units are marked dead."
            />
          </SummaryPanel>
          <SummaryPanel title="XP Awards">
            <SummaryLines
              lines={summary.xpAwards.map((row) => ({
                key: `xp-${row.unitKey}`,
                text: `${row.unitName} will gain ${row.xpEarned} XP.`,
              }))}
              empty="No XP awards are currently set."
            />
          </SummaryPanel>
          {showUpkeep ? (
            <SummaryPanel title={POSTBATTLE_SECTION_LABELS.upkeep}>
              {summary.payUpkeep ? (
                <p className="mt-2 text-sm text-foreground">
                  You will be paying {summary.upkeepTotal}gc in upkeep.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Pay upkeep is unchecked, so no Upkeep trade entry will be created.
                </p>
              )}
            </SummaryPanel>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={confirmDisabled}>
            {isFinalizing ? "Finalising..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
