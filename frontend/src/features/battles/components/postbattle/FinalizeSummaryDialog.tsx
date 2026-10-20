import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FinalizeSummaryPanels from "@/features/battles/components/postbattle/FinalizeSummaryPanels";
import type { FinalizeSummary } from "@/features/battles/components/postbattle/postbattle-summary";
import { HELPER_DIALOG_CONTENT_CLASS } from "@/features/battles/components/shared/battle-dialog-styles";

/** Finalise Postbattle: every permanent change finalising applies, then Confirm. */
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Finalise Postbattle</DialogTitle>
          <DialogDescription>
            Review the permanent changes that will be applied to {warbandName}.
          </DialogDescription>
        </DialogHeader>
        <FinalizeSummaryPanels summary={summary} showUpkeep={showUpkeep} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
