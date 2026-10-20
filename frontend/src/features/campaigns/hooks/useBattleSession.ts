import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// api
import { useOpenCampaignBattles } from "@/features/battles/hooks/useOpenCampaignBattles";

// other
import { isCampaignId } from "./useCampaignQuery";
import {
  getBattleRouteForStatus,
  getResumableBattleForUser,
  toCurrentBattleSession,
} from "@/features/battles/utils/battle-session";
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
 * The battle you can go back to from anywhere in the campaign (Rejoin Battle): the battle page
 * you are on, or else your resumable open battle, read from the open battles query the overview's
 * battle panel shares (it refetches on focus, on reconnect and on battle events).
 */
export function useBattleSession(campaignId: number, route: BattleRoute) {
  const navigate = useNavigate();
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

  const openBattles = useOpenCampaignBattles(campaignId, {
    enabled: !isBattleRoute && Boolean(userId),
  }).data;
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
    if (!openBattles) {
      return;
    }
    const nextSession = toCurrentBattleSession(getResumableBattleForUser(openBattles, userId));
    if (nextSession) {
      setCurrentBattleSession(nextSession);
    } else if (ownsSession) {
      clearCurrentBattleSession();
    }
  }, [
    campaignId,
    clearCurrentBattleSession,
    isBattleRoute,
    openBattles,
    sessionCampaignId,
    setCurrentBattleSession,
    userId,
  ]);

  const rejoinBattle = useCallback(() => {
    if (!currentBattleSession) {
      return;
    }
    const { campaignId: sessionCampaign, battleId: sessionBattle, status } = currentBattleSession;
    navigate(
      `/campaigns/${sessionCampaign}/battles/${sessionBattle}/${getBattleRouteForStatus(status)}`
    );
  }, [currentBattleSession, navigate]);

  return {
    /** Rejoin Battle shows outside the battle pages while you have a battle to go back to. */
    canRejoinBattle: Boolean(currentBattleSession) && !isBattleRoute,
    rejoinBattle,
  };
}
