import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { battleStateQuery } from "@/features/battles/api/battle-queries";
import { onBattleStatusChanged } from "@/features/battles/api/battle-status-changed";
import { getBattleStateLastEventId, mergeBattleState } from "@/features/battles/state/battle-cache";
import {
  createSingleFlight,
  reconcileBattleMessage,
} from "@/features/battles/state/battle-messages";
import type { BattleSocketMessage } from "@/features/battles/types/battle-messages";
import type { BattleState, BattleStateView } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { useBattleEvents, useRealtimeReconnect } from "@/lib/realtime";

type UseBattleStateOptions = {
  campaignId: number;
  battleId: number;
  /** The participant shape reads ask for (the page being shown). */
  view: BattleStateView;
};

/** A ref-like view of the cache: always the latest state, including optimistic changes. */
export type BattleStateRef = { readonly current: BattleState | null };

/**
 * The battle's state as a TanStack query (`['campaign', cid, 'battle', bid, 'state']`): one full
 * read per visit; writes' answers merged in with `applyBattleResponse`; socket messages patch it
 * from their snapshot (PERF-34), reading `state/` only on a version gap, one read at a time.
 * Answers older than the cache never replace it (BUG-44). It catches up after the socket comes
 * back, when the tab is shown again, and when a write is refused because the battle moved on
 * (BUG-19), so a phone that slept through End battle follows it.
 */
export function useBattleState({ campaignId, battleId, view }: UseBattleStateOptions) {
  const queryClient = useQueryClient();
  const validRoute = Number.isFinite(campaignId) && Number.isFinite(battleId);
  const queryKey = useMemo(
    () => queryKeys.campaign.battleState(campaignId, battleId),
    [battleId, campaignId]
  );

  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  });
  const query = useQuery({
    ...battleStateQuery(queryClient, campaignId, battleId, () => viewRef.current),
    enabled: validRoute,
  });

  const readState = useCallback(
    () => queryClient.getQueryData<BattleState>(queryKey) ?? null,
    [queryClient, queryKey]
  );
  const battleStateRef = useMemo<BattleStateRef>(
    () => ({
      get current() {
        return readState();
      },
    }),
    [readState]
  );
  const lastEventIdRef = useMemo(
    () => ({
      get current() {
        return getBattleStateLastEventId(readState());
      },
    }),
    [readState]
  );

  const updateBattleState = useCallback(
    (updater: (previous: BattleState | null) => BattleState | null) => {
      queryClient.setQueryData<BattleState>(
        queryKey,
        (previous: BattleState | undefined) => updater(previous ?? null) ?? undefined
      );
    },
    [queryClient, queryKey]
  );

  const applyBattleResponse = useCallback(
    (nextState: BattleState) => {
      updateBattleState((previous) => mergeBattleState(previous, nextState));
    },
    [updateBattleState]
  );

  const refreshBattleState = useCallback(
    () => queryClient.refetchQueries({ queryKey, exact: true }),
    [queryClient, queryKey]
  );
  // Gap reads join a read already running and read once more after it, never two at once.
  const gapRefresh = useMemo(
    () =>
      createSingleFlight(
        () => queryClient.refetchQueries({ queryKey, exact: true }, { cancelRefetch: false }),
        () => queryClient.isFetching({ queryKey, exact: true }) > 0
      ),
    [queryClient, queryKey]
  );

  // Messages sent while the socket was down or the tab hidden are gone: read what changed (BUG-19).
  // A read already running (the campaign's reconnect catch-up) is joined, not repeated.
  const catchUp = useCallback(() => {
    if (validRoute) {
      void queryClient.invalidateQueries({ queryKey, exact: true }, { cancelRefetch: false });
    }
  }, [queryClient, queryKey, validRoute]);
  useRealtimeReconnect(catchUp);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        catchUp();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const stopListening = onBattleStatusChanged((changedCampaignId, changedBattleId) => {
      if (changedCampaignId === campaignId && changedBattleId === battleId) {
        catchUp();
      }
    });
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopListening();
    };
  }, [battleId, campaignId, catchUp]);

  // Battle writes name this tab's socket, so the server never sends this tab its own events; any
  // event that arrives is news, even one your own user sent from another tab or device (BUG-75).
  useBattleEvents(validRoute ? battleId : null, (message) => {
    const outcome = reconcileBattleMessage(readState(), message as BattleSocketMessage);
    if (outcome.next) {
      queryClient.setQueryData<BattleState>(queryKey, outcome.next);
    }
    if (outcome.refetch === "gap") {
      gapRefresh.request();
    } else if (outcome.refetch === "legacy") {
      // A message without a version (an older server): read the newer events, as before.
      void refreshBattleState();
    }
  });

  const battleState = query.data ?? null;
  const isLoading = validRoute && query.isPending;
  let error = "";
  if (!validRoute) {
    error = "Invalid battle route.";
  } else if (!battleState && query.error) {
    error = getErrorMessage(query.error, "Unable to load battle");
  }

  return useMemo(
    () => ({
      battleState,
      battleStateRef,
      isLoading,
      error,
      lastEventIdRef,
      updateBattleState,
      applyBattleResponse,
      refreshBattleState,
    }),
    [
      applyBattleResponse,
      battleState,
      battleStateRef,
      error,
      isLoading,
      lastEventIdRef,
      refreshBattleState,
      updateBattleState,
    ]
  );
}
