import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

// api
import { useYourOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";

// other
import { isCampaignId } from "./useCampaignQuery";
import { toCurrentBattleSession } from "@/features/battles/utils/battle-session";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@/stores/app-store";

/** Where the URL is inside a campaign: a battle page, and which battle and phase it shows. */
export type BattleRoute = {
  isBattleRoute: boolean;
  battleId: number;
  stage: string;
};

const stageStatus = (stage: string) =>
  stage === "active" ? "active" : stage === "postbattle" ? "postbattle" : "prebattle";

/**
 * Your unfinished battles from anywhere in the campaign, the one that needs you most first: the
 * rejoin banner shows it, and the rail's Rejoin and the phone's Battle go to it. Read from the
 * open battles query the overview and the Battles page share (it refetches on focus, on
 * reconnect, on battle events and as you leave a battle's pages). The store's current battle
 * follows it, or the battle page you are on.
 */
export function useBattleSession(campaignId: number, route: BattleRoute) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, currentBattleSession, setCurrentBattleSession, clearCurrentBattleSession } =
    useAppStore();
  const { isBattleRoute, battleId, stage } = route;
  const userId = user?.id;

  useEffect(() => {
    if (!isBattleRoute || Number.isNaN(battleId) || !isCampaignId(campaignId)) {
      return;
    }
    setCurrentBattleSession({ battleId, campaignId, status: stageStatus(stage) });
  }, [battleId, campaignId, isBattleRoute, setCurrentBattleSession, stage]);

  // What you did on a battle's pages (got ready, fought, finished) is read again as you leave
  // them, so the banner's button says where you stand now. A read already under way is kept.
  const wasBattleRoute = useRef(isBattleRoute);
  useEffect(() => {
    if (wasBattleRoute.current && !isBattleRoute && isCampaignId(campaignId)) {
      void queryClient.invalidateQueries(
        { queryKey: queryKeys.campaign.openBattles(campaignId) },
        { cancelRefetch: false }
      );
    }
    wasBattleRoute.current = isBattleRoute;
  }, [campaignId, isBattleRoute, queryClient]);

  const { battles: yourBattles, loaded } = useYourOpenBattles(campaignId, {
    enabled: !isBattleRoute && Boolean(userId),
  });
  const lead = yourBattles[0] ?? null;
  const sessionCampaignId = currentBattleSession?.campaignId;

  useEffect(() => {
    if (isBattleRoute) {
      return;
    }
    const ownsSession = sessionCampaignId === undefined || sessionCampaignId === campaignId;
    if (!isCampaignId(campaignId) || !userId) {
      if (ownsSession) {
        clearCurrentBattleSession();
      }
      return;
    }
    // Not loaded yet, or the last load failed: keep the existing store value.
    if (!loaded) {
      return;
    }
    const nextSession = toCurrentBattleSession(lead?.state ?? null);
    if (nextSession) {
      setCurrentBattleSession(nextSession);
    } else if (ownsSession) {
      clearCurrentBattleSession();
    }
  }, [
    campaignId,
    clearCurrentBattleSession,
    isBattleRoute,
    lead,
    loaded,
    sessionCampaignId,
    setCurrentBattleSession,
    userId,
  ]);

  const href = lead?.href;
  const rejoinBattle = useCallback(() => {
    if (href) {
      navigate(href);
    }
  }, [href, navigate]);

  return {
    /** Your unfinished battles, the one that needs you most first. */
    yourBattles,
    /** Rejoin shows outside the battle pages while you have a battle to go back to. */
    canRejoinBattle: Boolean(lead) && !isBattleRoute,
    rejoinBattle,
  };
}
