import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PrebattleDialogsProps = {
  isLeaveDialogOpen: boolean;
  onLeaveDialogChange: (open: boolean) => void;
  onConfirmLeave: () => void;
  isStartDialogOpen: boolean;
  onStartDialogChange: (open: boolean) => void;
  startError: string;
  isStartingBattle: boolean;
  onConfirmStart: () => void;
  isCancelBattleDialogOpen: boolean;
  onCancelBattleDialogChange: (open: boolean) => void;
  cancelBattleError: string;
  isCancelingBattle: boolean;
  onConfirmCancelBattle: () => void;
};

export default function PrebattleDialogs({
  isLeaveDialogOpen,
  onLeaveDialogChange,
  onConfirmLeave,
  isStartDialogOpen,
  onStartDialogChange,
  startError,
  isStartingBattle,
  onConfirmStart,
  isCancelBattleDialogOpen,
  onCancelBattleDialogChange,
  cancelBattleError,
  isCancelingBattle,
  onConfirmCancelBattle,
}: PrebattleDialogsProps) {
  const [cancelConfirmed, setCancelConfirmed] = useState(false);

  useEffect(() => {
    if (!isCancelBattleDialogOpen) {
      setCancelConfirmed(false);
    }
  }, [isCancelBattleDialogOpen]);

  return (
    <>
      <ConfirmDialog
        open={isLeaveDialogOpen}
        onOpenChange={onLeaveDialogChange}
        description={
          <div className="space-y-2">
            <p>Leave this battle session?</p>
            <p className="text-xs text-muted-foreground">
              You can return later from the campaign overview while the battle is still open.
            </p>
          </div>
        }
        confirmText="Leave"
        confirmVariant="secondary"
        onConfirm={onConfirmLeave}
        onCancel={() => onLeaveDialogChange(false)}
      />

      <ConfirmDialog
        open={isStartDialogOpen}
        onOpenChange={onStartDialogChange}
        description={
          <div className="space-y-2">
            <p>All participants are ready. Start the battle now?</p>
            {startError ? <p className="text-sm text-red-600">{startError}</p> : null}
          </div>
        }
        confirmText={isStartingBattle ? "Starting..." : "Start"}
        confirmDisabled={isStartingBattle}
        isConfirming={isStartingBattle}
        confirmVariant="default"
        onConfirm={onConfirmStart}
        onCancel={() => onStartDialogChange(false)}
      />

      <Dialog
        open={isCancelBattleDialogOpen}
        onOpenChange={onCancelBattleDialogChange}
      >
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Cancel Battle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p>Cancel this battle for all participants?</p>
            <p className="text-xs text-muted-foreground">
              This is only available before the battle starts.
            </p>
            <label className="mt-3 flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground">
              <Checkbox
                checked={cancelConfirmed}
                disabled={isCancelingBattle}
                onChange={(event) => setCancelConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              <span>I understand this will cancel the battle for all participants.</span>
            </label>
            {cancelBattleError ? <p className="text-sm text-red-600">{cancelBattleError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onCancelBattleDialogChange(false)}
              disabled={isCancelingBattle}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmCancelBattle}
              disabled={isCancelingBattle || !cancelConfirmed}
            >
              {isCancelingBattle ? "Canceling..." : "Cancel battle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
