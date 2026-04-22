import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getBattleState } from "@/features/battles/api/battles-api";
import type { BattleState, BattleStateView } from "@/features/battles/types/battle-types";
import { createBattleSessionSocket } from "@/lib/realtime";

import {
  getBattleStateLastEventId,
  mergeBattleState,
  shouldIgnoreBattleSocketEvent,
} from "../utils/battle-state";

type UseBattleStateOptions = {
  campaignId: number;
  battleId: number;
  view: BattleStateView;
  currentUserId?: number | null;
};

export function useBattleState({
  campaignId,
  battleId,
  view,
  currentUserId,
}: UseBattleStateOptions) {
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const battleStateRef = useRef<BattleState | null>(null);
  const lastEventIdRef = useRef(0);

  const syncStateRefs = useCallback((nextState: BattleState | null) => {
    battleStateRef.current = nextState;
    lastEventIdRef.current = getBattleStateLastEventId(nextState);
  }, []);

  const replaceBattleState = useCallback(
    (nextState: BattleState | null) => {
      syncStateRefs(nextState);
      setBattleState(nextState);
    },
    [syncStateRefs]
  );

  const updateBattleState = useCallback(
    (updater: (previous: BattleState | null) => BattleState | null) => {
      setBattleState((previous) => {
        const nextState = updater(previous);
        syncStateRefs(nextState);
        return nextState;
      });
    },
    [syncStateRefs]
  );

  const applyBattleResponse = useCallback(
    (nextState: BattleState) => {
      updateBattleState((previous) => mergeBattleState(previous, nextState));
    },
    [updateBattleState]
  );

  const refreshBattleState = useCallback(
    async ({ forceFull = false }: { forceFull?: boolean } = {}) => {
      if (Number.isNaN(campaignId) || Number.isNaN(battleId)) {
        return null;
      }
      const nextState = await getBattleState(campaignId, battleId, {
        sinceEventId: forceFull ? 0 : lastEventIdRef.current,
        view,
      });
      applyBattleResponse(nextState);
      return nextState;
    },
    [applyBattleResponse, battleId, campaignId, view]
  );

  useEffect(() => {
    if (Number.isNaN(campaignId) || Number.isNaN(battleId)) {
      setError("Invalid battle route.");
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError("");
    getBattleState(campaignId, battleId, { sinceEventId: 0, view })
      .then((nextState) => {
        if (!active) {
          return;
        }
        replaceBattleState(nextState);
      })
      .catch((errorResponse) => {
        if (!active) {
          return;
        }
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load battle");
        } else {
          setError("Unable to load battle");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [battleId, campaignId, replaceBattleState, view]);

  useEffect(() => {
    if (Number.isNaN(battleId)) {
      return;
    }
    const socket = createBattleSessionSocket(battleId, (message) => {
      if (shouldIgnoreBattleSocketEvent(message, currentUserId)) {
        return;
      }
      void refreshBattleState();
    });
    return () => {
      socket.close();
    };
  }, [battleId, currentUserId, refreshBattleState]);

  return useMemo(
    () => ({
      battleState,
      battleStateRef,
      isLoading,
      error,
      lastEventIdRef,
      replaceBattleState,
      updateBattleState,
      applyBattleResponse,
      refreshBattleState,
    }),
    [
      applyBattleResponse,
      battleState,
      error,
      isLoading,
      refreshBattleState,
      replaceBattleState,
      updateBattleState,
    ]
  );
}
