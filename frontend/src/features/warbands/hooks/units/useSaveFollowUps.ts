import { useRef, useState } from "react";

import { getWarbandSummary } from "@/features/warbands/api/warbands-api";
import { useWarbandCacheUpdate } from "@/features/warbands/api/warband-cache";
import { describeFollowUps, runFollowUps, type FollowUp } from "../../utils/follow-ups";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * What a Save still had to do after its batch went through, and its retry. Each step runs once:
 * the steps a failure leaves are kept, named in the notice, and retried on their own (or with
 * the next Save's), so neither the batch nor a purchase that went through is ever sent twice.
 */
export function useSaveFollowUps() {
  const updateWarbandCache = useWarbandCacheUpdate();
  const leftRef = useRef<FollowUp[]>([]);
  const [notice, setNotice] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  const finish = async (warbandId: number, steps: FollowUp[]) => {
    const all = [...leftRef.current, ...steps];
    if (all.length === 0) return;
    const { remaining, error } = await runFollowUps(all);
    leftRef.current = remaining;
    setNotice(
      remaining.length > 0
        ? `Saved, but not done yet: ${describeFollowUps(remaining)}. ${getErrorMessage(error)} Retry finishes these without saving the roster again.`
        : ""
    );
    try {
      // Trades and stash removals moved gold and items the batch's summary doesn't show.
      updateWarbandCache(warbandId, { summary: await getWarbandSummary(warbandId) });
    } catch {
      // The cached summary stays until the next read.
    }
  };

  const retry = async (warbandId: number) => {
    setIsRetrying(true);
    try {
      await finish(warbandId, []);
    } finally {
      setIsRetrying(false);
    }
  };

  return { notice, isRetrying, finish, retry };
}
