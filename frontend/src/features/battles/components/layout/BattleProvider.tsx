import { useEffect, useMemo, type ReactNode } from "react";
import { Navigate, useOutletContext, useParams } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import BattleSkeleton from "@/features/battles/components/battle/BattleSkeleton";
import { useBattleCapabilities } from "@/features/battles/hooks/useBattleCapabilities";
import { useBattleRosters } from "@/features/battles/hooks/useBattleRosters";
import { useBattleEntranceReady } from "@/features/battles/hooks/useBattleEntrance";
import { useCampaignBattleRules } from "@/features/battles/hooks/useCampaignBattleRules";
import { useBattleState } from "@/features/battles/hooks/useBattleState";
import { BattleContext, type BattleContextValue } from "@/features/battles/state/battle-context";
import {
  battleViewPath,
  deriveBattleView,
  type BattlePhase,
} from "@/features/battles/state/battle-machine";
import { toastBattleOver } from "@/features/battles/utils/battle-over";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

/**
 * Loads the battle once for the invitation, pre-battle and battle pages (state and rosters), sends
 * the user to the page the battle is on for him (`deriveBattleView`, with a toast when it ended or
 * was cancelled; `phase` null, the bare battle URL, always redirects), and shares the battle with
 * that page through `BattleContext`. `BattleLayout` keeps it mounted across phase changes.
 */
export default function BattleProvider({
  phase,
  children,
}: {
  phase: BattlePhase | null;
  children: ReactNode;
}) {
  const { id, battleId } = useParams();
  const campaignId = Number(id);
  const numericBattleId = Number(battleId);
  const { user } = useAuth();
  const outlet = useOutletContext<CampaignLayoutContext | undefined>();
  const managesBattles = campaignCapabilities(outlet?.campaign).manage_battles;
  const reader = useMemo(() => ({ userId: user?.id, managesBattles }), [managesBattles, user?.id]);

  const {
    battleState: cachedState,
    battleStateRef,
    isLoading,
    error,
    applyBattleResponse,
    updateBattleState,
    refreshBattleState,
    joinRead,
  } = useBattleState({
    campaignId,
    battleId: numericBattleId,
    view: phase ?? "prebattle",
    reader,
  });
  const { rosters, rosterLoading, rosterErrors } = useBattleRosters(
    campaignId,
    numericBattleId,
    cachedState?.participants
  );

  // Broadcasts may leave the rules out, or their injury lines; the campaign's last ones stand in
  // (item 8).
  const rules = useCampaignBattleRules(campaignId, cachedState?.rules);
  const battleState = useMemo(
    () =>
      cachedState && rules && cachedState.rules !== rules ? { ...cachedState, rules } : cachedState,
    [cachedState, rules]
  );
  const view = deriveBattleView({
    page: phase,
    isLoading,
    error,
    battle: battleState?.battle,
    participantStatus: battleState?.participants.find((entry) => entry.user.id === user?.id)
      ?.status,
  });
  const capabilities = useBattleCapabilities({
    battleState,
    onPage: view.kind === "ready",
    joinRead,
  });
  const value = useMemo<BattleContextValue | null>(
    () =>
      battleState
        ? {
            campaignId,
            battleId: numericBattleId,
            phase: phase ?? "prebattle",
            battleState,
            capabilities,
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
      capabilities,
      numericBattleId,
      phase,
      rosterErrors,
      rosterLoading,
      rosters,
      updateBattleState,
    ]
  );

  // The battle ended or was cancelled: say so as the page closes (BATL-NEW-08).
  const closesToOverview = view.kind === "redirect" && view.to === "overview";
  useEffect(() => {
    const latest = battleStateRef.current;
    if (closesToOverview && latest) {
      toastBattleOver(latest, user?.id);
    }
  }, [battleStateRef, closesToOverview, user?.id]);
  // A battle that fails to load lets the entrance's swords go, so its error shows.
  useBattleEntranceReady(view.kind === "error");

  if (view.kind === "loading") {
    return <BattleSkeleton phase={phase} />;
  }
  if (view.kind === "error") {
    return <p className="px-4 py-6 text-sm text-danger">{view.message}</p>;
  }
  if (view.kind === "redirect") {
    return <Navigate to={battleViewPath(view.to, campaignId, numericBattleId)} replace />;
  }
  return <BattleContext.Provider value={value}>{children}</BattleContext.Provider>;
}
