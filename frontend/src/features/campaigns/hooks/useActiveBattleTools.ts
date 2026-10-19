import { useState } from "react";

import { apiErrorCode, getErrorMessage } from "@/lib/get-error-message";

import type { CampaignActiveBattle } from "../types/campaign-types";

type Results = { winners: number[]; losers: number[] };

/**
 * Settings > Active Battles' tools on one battle at a time (BATL-NEW-03): End a stuck fight and
 * Confirm results (both through the results modal), Cancel (before postbattle) and Close
 * postbattle (BUG-09), each behind its confirm, with its request and error.
 */
export function useActiveBattleTools({
  onCancelBattle,
  onCloseBattle,
  onEndBattle,
  onConfirmResults,
}: {
  onCancelBattle: (battleId: number) => Promise<void>;
  onCloseBattle: (battleId: number) => Promise<void>;
  onEndBattle?: (battleId: number, results: Results) => Promise<void>;
  onConfirmResults?: (battleId: number, results: Results) => Promise<void>;
}) {
  const [resultsTarget, setResultsTarget] = useState<{
    battle: CampaignActiveBattle;
    mode: "end" | "confirm";
  } | null>(null);
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<CampaignActiveBattle | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [closeTarget, setCloseTarget] = useState<CampaignActiveBattle | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [closeError, setCloseError] = useState("");

  const askCancel = (battle: CampaignActiveBattle) => {
    setCancelTarget(battle);
    setCancelError("");
  };
  const askClose = (battle: CampaignActiveBattle) => {
    setCloseTarget(battle);
    setCloseError("");
  };

  const askResults = (battle: CampaignActiveBattle, mode: "end" | "confirm") => {
    setResultsTarget({ battle, mode });
    setResultsError("");
  };
  const dismissResults = () => {
    if (!isSubmittingResults) {
      setResultsTarget(null);
    }
  };
  const submitResults = async (results: Results) => {
    if (!resultsTarget) {
      return;
    }
    const send = resultsTarget.mode === "end" ? onEndBattle : onConfirmResults;
    setIsSubmittingResults(true);
    setResultsError("");
    try {
      await send?.(resultsTarget.battle.battle.id, results);
      setResultsTarget(null);
    } catch (errorResponse) {
      setResultsError(getErrorMessage(errorResponse, "Unable to save the results"));
    } finally {
      setIsSubmittingResults(false);
    }
  };

  const dismissCancel = () => {
    if (isCanceling) {
      return;
    }
    setCancelTarget(null);
    setCancelError("");
  };
  const dismissClose = () => {
    if (!isClosing) {
      setCloseTarget(null);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) {
      return false;
    }
    setIsCanceling(true);
    setCancelError("");
    try {
      await onCancelBattle(cancelTarget.battle.id);
      setCancelTarget(null);
      return true;
    } catch (errorResponse) {
      if (apiErrorCode(errorResponse) === "use_close_postbattle") {
        // It reached postbattle since the list loaded: offer Close postbattle instead.
        setCloseTarget({
          ...cancelTarget,
          battle: { ...cancelTarget.battle, status: "postbattle" },
        });
        setCloseError("This battle has reached postbattle, so it can only be closed.");
        setCancelTarget(null);
      } else {
        setCancelError(getErrorMessage(errorResponse, "Unable to cancel battle"));
      }
      return false;
    } finally {
      setIsCanceling(false);
    }
  };

  const confirmClose = async () => {
    if (!closeTarget) {
      return;
    }
    setIsClosing(true);
    setCloseError("");
    try {
      await onCloseBattle(closeTarget.battle.id);
      setCloseTarget(null);
    } catch (errorResponse) {
      setCloseError(getErrorMessage(errorResponse, "Unable to close postbattle"));
    } finally {
      setIsClosing(false);
    }
  };

  return {
    cancel: { target: cancelTarget, isCanceling, error: cancelError },
    close: { target: closeTarget, isClosing, error: closeError },
    results: { target: resultsTarget, isSubmitting: isSubmittingResults, error: resultsError },
    askResults,
    dismissResults,
    submitResults,
    askCancel,
    askClose,
    dismissCancel,
    dismissClose,
    confirmCancel,
    confirmClose,
  };
}

export type ActiveBattleTools = ReturnType<typeof useActiveBattleTools>;
