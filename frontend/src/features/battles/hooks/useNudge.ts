import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { nudgePlayer } from "@/features/battles/api/battles-api";
import type { BattleEvent, BattleState } from "@/features/battles/types/battle-types";
import { ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/get-error-message";

/** One nudge per pair of players per battle every 10 minutes (BATL-NEW-08). */
export const NUDGE_GAP_MS = 10 * 60 * 1000;

/** How long until `fromUserId` may nudge `targetUserId` again, from the battle's timeline. */
export function nudgeWaitMs(
  events: BattleEvent[],
  fromUserId: number | undefined,
  targetUserId: number,
  now = Date.now()
) {
  const last = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === "participant_nudged" &&
        event.payload_json?.target_user_id === targetUserId &&
        (event.payload_json?.nudged_by_user_id ?? event.actor_user_id) === fromUserId
    );
  const sentAt = last ? Date.parse(last.created_at) : Number.NaN;
  return Number.isFinite(sentAt) ? Math.max(0, sentAt + NUDGE_GAP_MS - now) : 0;
}

/**
 * Nudge a player who is holding up the battle (`nudge/`): they get a notification. The limit
 * shows on the button ("again in 7 min"), from your last nudge in the timeline, or from the
 * server's `retry_after` when it refuses one.
 */
export function useNudge({
  campaignId,
  battleId,
  events,
  userId,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  events: BattleEvent[];
  userId: number | undefined;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [retryUntil, setRetryUntil] = useState<Record<number, number>>({});
  const [sendingTo, setSendingTo] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const waitFor = useCallback(
    (targetUserId: number) =>
      Math.max(
        nudgeWaitMs(events, userId, targetUserId, now),
        (retryUntil[targetUserId] ?? 0) - now
      ),
    [events, now, retryUntil, userId]
  );

  const nudge = useCallback(
    async (targetUserId: number, label: string) => {
      setSendingTo(targetUserId);
      try {
        applyBattleResponse(await nudgePlayer(campaignId, battleId, targetUserId));
        setNow(Date.now());
        toast(`${label} has been nudged.`);
      } catch (error) {
        const retryAfter =
          error instanceof ApiError && error.status === 429
            ? Number((error.data as { retry_after?: unknown } | null)?.retry_after)
            : Number.NaN;
        if (Number.isFinite(retryAfter)) {
          setRetryUntil((current) => ({
            ...current,
            [targetUserId]: Date.now() + retryAfter * 1000,
          }));
          setNow(Date.now());
          toast.error(
            `You nudged ${label} not long ago; you can again in ${Math.ceil(retryAfter / 60)} min.`
          );
        } else {
          toast.error(getErrorMessage(error, "Couldn't nudge them."));
        }
      } finally {
        setSendingTo(null);
      }
    },
    [applyBattleResponse, battleId, campaignId]
  );

  return { waitFor, nudge, sendingTo };
}
