import { ConfirmDialog } from "@components/confirm-dialog";
import BattleResultsDialog from "@/features/battles/components/shared/BattleResultsDialog";
import ClosePostbattleDialog from "@/features/battles/components/shared/ClosePostbattleDialog";
import { resultsWarbands } from "@/features/battles/utils/battle-results";

import type { ActiveBattleTools } from "../../hooks/useActiveBattleTools";

const END_COPY =
  "Everyone still fighting goes to postbattle with these results. Drag each warband to Winners or Losers, or use its move button; an empty Winners column is No winner. Wins and losses are recorded when everyone has finished postbattle.";
const CONFIRM_COPY =
  "Drag each warband to Winners or Losers, or use its move button; an empty Winners column is No winner. The battle ends once the results are confirmed and every postbattle is done.";

/**
 * Active Battles' confirms: End a stuck fight or Confirm its results (the results modal), Cancel a
 * battle for everyone, or Close its postbattle.
 */
export default function ActiveBattleDialogs({
  tools,
  onCanceled,
}: {
  tools: ActiveBattleTools;
  onCanceled: (battleId: number) => void;
}) {
  const { cancel, close, results } = tools;
  const target = results.target;
  const ending = target?.mode === "end";
  return (
    <>
      <BattleResultsDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && tools.dismissResults()}
        title={ending ? "End battle" : "Confirm results"}
        description={ending ? END_COPY : CONFIRM_COPY}
        warbands={resultsWarbands(target?.battle.participants ?? [])}
        initialWinners={
          ending
            ? (target?.battle.participants ?? [])
                .filter((participant) => participant.declared_result === "won")
                .map((participant) => participant.warband.id)
            : (target?.battle.battle.winner_warband_ids_json ?? [])
        }
        confirmLabel={ending ? "End battle" : "Confirm results"}
        isSubmitting={results.isSubmitting}
        error={results.error}
        onSubmit={(picked) => void tools.submitResults(picked)}
      />
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
