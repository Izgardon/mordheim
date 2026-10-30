import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@/stores/app-store";

type ResultAction = "approve" | "decline" | "withdraw";

const SEND = {
  approve: approveReportedBattleResult,
  decline: declineReportedBattleResult,
  withdraw: withdrawReportedBattleResult,
} as const;

const QUESTION = {
  decline: "Decline this result? It is cancelled for every player and records nothing.",
  withdraw: "Withdraw this result? It is cancelled for every player and records nothing.",
} as const;

function waitingLine(result: PendingReportedResult) {
  if (result.awaiting_my_answer) return "Waiting for your answer";
  const waiting = result.participants
    .filter((participant) => participant.status === "reported_result_pending")
    .map((participant) => participant.user_label);
  return waiting.length ? `Waiting for ${waiting.join(", ")}` : "Waiting for answers";
}

/**
 * Reported results still waiting for answers (BUG-46), on the overview: Approve and Decline for
 * the players asked, Withdraw for the one who reported it; Decline and Withdraw ask first.
 */
export default function PendingResults({ campaignId }: { campaignId: number }) {
  const queryClient = useQueryClient();
  const { removeBattleResultRequestNotification } = useAppStore();
  const results = usePendingReportedResults(campaignId).data ?? [];
  const [busy, setBusy] = useState<number | null>(null);
  const [failure, setFailure] = useState<{ battleId: number; message: string } | null>(null);
  const [confirming, setConfirming] = useState<{
    result: PendingReportedResult;
    action: "decline" | "withdraw";
  } | null>(null);
  if (!results.length) return null;

  const run = async (result: PendingReportedResult, action: ResultAction) => {
    setBusy(result.battle_id);
    setFailure(null);
    try {
      await SEND[action](campaignId, result.battle_id);
      removeBattleResultRequestNotification(`battle-result-${result.battle_id}`);
      setConfirming(null);
      void invalidateOpenBattles(queryClient, campaignId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.battleHistory(campaignId),
      });
      await invalidatePendingResults(queryClient, campaignId);
    } catch (error) {
      setFailure({ battleId: result.battle_id, message: getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="results-h" className="flex flex-col gap-2">
      <h2
        id="results-h"
        className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-faint"
      >
        {results.some((result) => result.awaiting_my_answer)
          ? "Results awaiting your answer"
          : "Results awaiting answers"}
      </h2>
      {results.map((result) => (
        <article
          key={result.battle_id}
          className="flex flex-wrap items-center justify-between gap-3 border border-accent-line bg-surface px-4 py-3"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-[17px] font-semibold text-head">
              {result.scenario || `Battle #${result.battle_id}`}
            </span>
            <span className="text-xs text-muted-foreground">
              {[result.battle_date, `reported by ${result.created_by_user_label}`]
                .filter(Boolean)
                .join(" · ")}
              {" · winners: "}
              {result.winner_warband_names.join(", ") || "no winner"}
            </span>
            <span className="text-xs text-accent-text">{waitingLine(result)}</span>
            {failure?.battleId === result.battle_id ? (
              <span role="alert" className="text-xs text-danger">
                {failure.message}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {result.can_withdraw ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => setConfirming({ result, action: "withdraw" })}
              >
                Withdraw
              </Button>
            ) : null}
            {result.awaiting_my_answer ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => setConfirming({ result, action: "decline" })}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void run(result, "approve")}
                >
                  {busy === result.battle_id ? "Saving…" : "Approve"}
                </Button>
              </>
            ) : null}
          </div>
        </article>
      ))}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => (open ? null : setConfirming(null))}
        title={confirming?.action === "decline" ? "Decline" : "Withdraw"}
        description={confirming ? QUESTION[confirming.action] : ""}
        confirmText={confirming?.action === "decline" ? "Decline" : "Withdraw"}
        isConfirming={busy !== null}
        error={
          confirming && failure?.battleId === confirming.result.battle_id ? failure.message : ""
        }
        onConfirm={() => (confirming ? void run(confirming.result, confirming.action) : undefined)}
      />
    </section>
  );
}
