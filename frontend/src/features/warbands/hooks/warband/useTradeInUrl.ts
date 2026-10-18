import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { tradeQuery } from "../../api/economy-queries";
import { getErrorMessage } from "@/lib/get-error-message";

type UseTradeInUrlOptions = {
  campaignId: number;
  /** Read the trade at all (the warband's owner, signed in, on a valid campaign). */
  enabled: boolean;
};

/**
 * The trade `?trade=<id>` names, and the trade query that holds it: read once per visit
 * (BUG-113), with a failed read said, not swallowed (ECON-UX-05).
 */
export function useTradeInUrl({ campaignId, enabled }: UseTradeInUrlOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tradeParam = searchParams.get("trade");
  // The latest URL, for callbacks that must not change with every ?tab= (ECON-PERF-02).
  const latest = useRef({ searchParams, setSearchParams });
  latest.current = { searchParams, setSearchParams };

  const trade = useQuery({
    ...tradeQuery(campaignId, tradeParam ?? ""),
    enabled: enabled && Boolean(tradeParam),
  });
  const request = enabled && tradeParam && trade.data?.id === tradeParam ? trade.data : null;

  /** Names the open trade in the URL (or none), keeping the other parameters. */
  const setTradeParam = useCallback((requestId: string | null) => {
    const next = new URLSearchParams(latest.current.searchParams);
    if (requestId) {
      next.set("trade", requestId);
    } else {
      next.delete("trade");
    }
    latest.current.setSearchParams(next, { replace: true });
  }, []);

  const failure = trade.isError ? trade.error : null;
  const hasCopy = trade.data !== undefined;
  useEffect(() => {
    if (failure) {
      toast.error(hasCopy ? "Couldn't load the trade." : "Couldn't open the trade.", {
        description: getErrorMessage(failure),
      });
    }
  }, [failure, hasCopy]);

  return { tradeParam, setTradeParam, request };
}
