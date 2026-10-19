import { ConfirmDialog } from "@components/confirm-dialog";
import ClosePostbattleDialog from "@/features/battles/components/shared/ClosePostbattleDialog";

import type { ActiveBattleTools } from "../../hooks/useActiveBattleTools";

/** Active Battles' confirms: Cancel a battle for everyone, or Close its postbattle. */
export default function ActiveBattleDialogs({
  tools,
  onCanceled,
}: {
  tools: ActiveBattleTools;
  onCanceled: (battleId: number) => void;
}) {
  const { cancel, close } = tools;
  return (
    <>
      <ConfirmDialog
        open={Boolean(cancel.target)}
        onOpenChange={(open) => {
          if (!open) {
            tools.dismissCancel();
          }
        }}
        description={
          <div className="space-y-2">
            <p>
              Cancel{" "}
              <span className="font-semibold text-foreground">
                {cancel.target?.battle.scenario || "this battle"}
              </span>{" "}
              for all participants?
            </p>
            {cancel.error ? <p className="text-sm text-red-600">{cancel.error}</p> : null}
          </div>
        }
        confirmText={cancel.isCanceling ? "Canceling..." : "Confirm cancel"}
        confirmVariant="destructive"
        confirmDisabled={cancel.isCanceling || !cancel.target}
        isConfirming={cancel.isCanceling}
        onConfirm={() => {
          const battleId = cancel.target?.battle.id;
          void tools.confirmCancel().then((canceled) => {
            if (canceled && battleId !== undefined) onCanceled(battleId);
          });
        }}
        onCancel={tools.dismissCancel}
      />
      <ClosePostbattleDialog
        open={Boolean(close.target)}
        onOpenChange={(open) => !open && tools.dismissClose()}
        participants={close.target?.participants ?? []}
        hasWinners={(close.target?.battle.winner_warband_ids_json ?? []).length > 0}
        isClosing={close.isClosing}
        error={close.error}
        onConfirm={() => void tools.confirmClose()}
      />
    </>
  );
}
