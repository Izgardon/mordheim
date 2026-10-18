import { useState } from "react";

import { useTradeLock, useTradeUnlock } from "../../api/economy-queries";
import { lockErrorMessage, tradeFromError } from "../../utils/trade-errors";

import type { TradeRequest, TradeSession } from "../../types/trade-request-types";

type UseTradeLockActionsOptions = {
  session: TradeSession | null;
  /** The offers' version on screen: Accept locks exactly what the player saw (BUG-35). */
  offerVersion?: number;
  myAccepted: boolean;
  /** Each answer (and a refused lock's current trade) goes to the page. */
  onRequestUpdated: (request: TradeRequest) => void;
};

/**
 * Accept (lock) and Unaccept (unlock) your side of a trade, with their pending states and the
 * error to show. Neither moves gold, so neither re-reads the summary (ECON-PERF-02).
 */
export function useTradeLockActions({
  session,
  offerVersion,
  myAccepted,
  onRequestUpdated,
}: UseTradeLockActionsOptions) {
  const { mutateAsync: lock } = useTradeLock();
  const { mutateAsync: unlock } = useTradeUnlock();
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [actionError, setActionError] = useState("");

  const accept = async () => {
    if (!session || myAccepted) {
      return;
    }
    setIsLocking(true);
    setActionError("");
    try {
      const { campaignId, requestId } = session;
      onRequestUpdated(await lock({ campaignId, requestId, offerVersion }));
    } catch (err) {
      // A refusal that carries the trade (the offers changed) shows it as it is now.
      const current = tradeFromError(err);
      if (current) {
        onRequestUpdated(current);
      }
      setActionError(lockErrorMessage(err));
    } finally {
      setIsLocking(false);
    }
  };

  const unaccept = async () => {
    if (!session || !myAccepted) {
      return;
    }
    setIsUnlocking(true);
    setActionError("");
    try {
      const { campaignId, requestId } = session;
      onRequestUpdated(await unlock({ campaignId, requestId }));
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message || "Unable to unaccept trade."
          : "Unable to unaccept trade."
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  return { accept, unaccept, isLocking, isUnlocking, actionError };
}
