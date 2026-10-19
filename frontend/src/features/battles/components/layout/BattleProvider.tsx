import { useMemo, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { useBattleRosters } from "@/features/battles/hooks/useBattleRosters";
import { useBattleState } from "@/features/battles/hooks/useBattleState";
import { BattleContext, type BattleContextValue } from "@/features/battles/state/battle-context";
import {
  battleViewPath,
  deriveBattleView,
  type BattlePhase,
} from "@/features/battles/state/battle-machine";

/**
 * Loads the battle once for every phase page (state and rosters), sends the user to the page the
 * battle is on (`deriveBattleView`), and shares the battle with that page through `BattleContext`.
 * `BattleLayout` keeps it mounted across phase changes, so moving on reads nothing again.
 */
export default function BattleProvider({
  phase,
  children,
}: {
  phase: BattlePhase;
  children: ReactNode;
}) {
  const { id, battleId } = useParams();
  const campaignId = Number(id);
  const numericBattleId = Number(battleId);

  const {
    battleState,
    battleStateRef,
    isLoading,
    error,
    applyBattleResponse,
    updateBattleState,
    refreshBattleState,
  } = useBattleState({ campaignId, battleId: numericBattleId, view: phase });
  const { rosters, rosterLoading, rosterErrors } = useBattleRosters(
    campaignId,
    numericBattleId,
    battleState?.participants
  );

  const value = useMemo<BattleContextValue | null>(
    () =>
      battleState
        ? {
            campaignId,
            battleId: numericBattleId,
            phase,
            battleState,
            battleStateRef,
            rosters,
            rosterLoading,
            rosterErrors,
            applyBattleResponse,
            updateBattleState,
            refreshBattleState,
          }
        : null,
    [
      applyBattleResponse,
      refreshBattleState,
      battleState,
      battleStateRef,
      campaignId,
      numericBattleId,
      phase,
      rosterErrors,
      rosterLoading,
      rosters,
      updateBattleState,
    ]
  );

  const view = deriveBattleView({ page: phase, isLoading, error, battle: battleState?.battle });
  if (view.kind === "loading") {
    return <LoadingScreen message={view.message} />;
  }
  if (view.kind === "error") {
    return <p className="text-sm text-red-600">{view.message}</p>;
  }
  if (view.kind === "redirect") {
    return <Navigate to={battleViewPath(view.to, campaignId, numericBattleId)} replace />;
  }
  return <BattleContext.Provider value={value}>{children}</BattleContext.Provider>;
}
