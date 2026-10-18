import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { battleStateQuery } from "@/features/battles/api/battle-queries";
import { getBattleStateLastEventId, mergeBattleState } from "@/features/battles/state/battle-cache";
import type { BattleState, BattleStateView } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { useBattleEvents } from "@/lib/realtime";

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
 * read per visit, writes' answers merged in with `applyBattleResponse`, and a read of the newer
 * events for each battle socket message.
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

  // Battle writes name this tab's socket, so the server never sends this tab its own events; any
  // event that arrives is news, even one your own user sent from another tab or device (BUG-75).
  useBattleEvents(validRoute ? battleId : null, () => {
    void refreshBattleState();
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
