import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  return (
    <>
      <ConfirmDialog
        open={isLeaveDialogOpen}
        onOpenChange={onLeaveDialogChange}
        description={
          <div className="space-y-2">
            <p>Leave this battle session?</p>
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

      <ConfirmDialog
        open={isCancelBattleDialogOpen}
        onOpenChange={onCancelBattleDialogChange}
        description={
          <div className="space-y-2">
            <p>Cancel this battle for all participants?</p>
            <p className="text-xs text-muted-foreground">
              This is only available before the battle starts.
            </p>
            {cancelBattleError ? <p className="text-sm text-red-600">{cancelBattleError}</p> : null}
          </div>
        }
        confirmText={isCancelingBattle ? "Canceling..." : "Cancel battle"}
        confirmDisabled={isCancelingBattle}
        isConfirming={isCancelingBattle}
        confirmVariant="destructive"
        onConfirm={onConfirmCancelBattle}
        onCancel={() => onCancelBattleDialogChange(false)}
      />
    </>
  );
}

