import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { CardBackground } from "@/components/ui/card-background";
import {
  approveReportedBattleResult,
  declineReportedBattleResult,
  withdrawReportedBattleResult,
} from "@/features/battles/api/battles-api";
import { invalidateOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import {
  invalidatePendingResults,
  usePendingReportedResults,
} from "@/features/battles/hooks/usePendingReportedResults";
import type { PendingReportedResult } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppStore } from "@/stores/app-store";

type ResultAction = "approve" | "decline" | "withdraw";

const send = (action: ResultAction, campaignId: number, battleId: number) => {
  if (action === "approve") return approveReportedBattleResult(campaignId, battleId);
  if (action === "decline") return declineReportedBattleResult(campaignId, battleId);
  return withdrawReportedBattleResult(campaignId, battleId);
};

const CONFIRM_COPY: Record<"decline" | "withdraw", { text: string; question: string }> = {
  decline: {
    text: "Decline",
    question: "Decline this result? It is cancelled for every player and records nothing.",
  },
  withdraw: {
    text: "Withdraw",
    question: "Withdraw this result? It is cancelled for every player and records nothing.",
  },
};

function waitingLine(result: PendingReportedResult) {
  if (result.awaiting_my_answer) {
    return "Waiting for your answer";
  }
  const waitingFor = result.participants
    .filter((participant) => participant.status === "reported_result_pending")
    .map((participant) => participant.user_label);
  return waitingFor.length > 0 ? `Waiting for ${waitingFor.join(", ")}` : "Waiting for answers";
}

/**
 * Reported results waiting for answers, on the campaign overview (BUG-46): Approve and Decline for
 * the players asked, Withdraw for the submitter. The bell's notification is only a pointer here;
 * clearing it leaves the result to answer on this card.
 */
export default function PendingResultsCard({ campaignId }: { campaignId: number }) {
  const queryClient = useQueryClient();
  const { removeBattleResultRequestNotification } = useAppStore();
  const results = usePendingReportedResults(campaignId).data ?? [];
  const [pendingBattleId, setPendingBattleId] = useState<number | null>(null);
  const [failure, setFailure] = useState<{ battleId: number; message: string } | null>(null);
  const [confirming, setConfirming] = useState<{
    result: PendingReportedResult;
    action: "decline" | "withdraw";
  } | null>(null);

  if (results.length === 0) {
    return null;
  }

  const run = async (result: PendingReportedResult, action: ResultAction) => {
    setPendingBattleId(result.battle_id);
    setFailure(null);
    try {
      await send(action, campaignId, result.battle_id);
      removeBattleResultRequestNotification(`battle-result-${result.battle_id}`);
      setConfirming(null);
      void invalidateOpenBattles(queryClient, campaignId);
      await invalidatePendingResults(queryClient, campaignId);
    } catch (error) {
      setFailure({
        battleId: result.battle_id,
        message: getErrorMessage(error, "That didn't go through. Please try again."),
      });
    } finally {
      setPendingBattleId(null);
    }
  };

  const heading = results.some((result) => result.awaiting_my_answer)
    ? "Results awaiting your approval"
    : "Results awaiting approval";

  return (
    <section aria-label={heading} className="mx-2 mt-3 sm:mx-0">
      <CardBackground className="space-y-3 p-3">
        <h2 className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
          {heading}
        </h2>
        {results.map((result) => {
          const busy = pendingBattleId === result.battle_id;
          return (
            <div key={result.battle_id} className="surface-panel-strong space-y-2 rounded-xl p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {result.scenario || `Battle #${result.battle_id}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[result.battle_date, `Reported by ${result.created_by_user_label}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Winners:{" "}
                  {result.winner_warband_names.length > 0
                    ? result.winner_warband_names.join(", ")
                    : "No winner"}
                </p>
                <p className="text-xs text-amber-300">{waitingLine(result)}</p>
              </div>
              {failure?.battleId === result.battle_id ? (
                <p role="alert" className="text-xs text-red-400">
                  {failure.message}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                {result.can_withdraw ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirming({ result, action: "withdraw" })}
                  >
                    Withdraw
                  </Button>
                ) : null}
                {result.awaiting_my_answer ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirming({ result, action: "decline" })}
                    >
                      Decline
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void run(result, "approve")}>
                      {busy ? "Saving..." : "Approve"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        <ConfirmDialog
          open={confirming !== null}
          onOpenChange={(open) => !open && setConfirming(null)}
          title={confirming ? CONFIRM_COPY[confirming.action].text : undefined}
          description={
            confirming ? (
              <div className="space-y-2">
                <p>{CONFIRM_COPY[confirming.action].question}</p>
                {failure?.battleId === confirming.result.battle_id ? (
                  <p className="text-sm text-red-600">{failure.message}</p>
                ) : null}
              </div>
            ) : null
          }
          confirmText={confirming ? CONFIRM_COPY[confirming.action].text : "Confirm"}
          isConfirming={pendingBattleId !== null}
          onConfirm={() => confirming && void run(confirming.result, confirming.action)}
        />
      </CardBackground>
    </section>
  );
}
