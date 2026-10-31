import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { finalizeBattlePostbattle } from "@/features/battles/api/battles-api";
import {
  invalidateOpenBattles,
  useOpenCampaignBattles,
} from "@/features/battles/hooks/useOpenCampaignBattles";
import { toastBattleWarnings } from "@/features/battles/utils/battle-warnings";
import { warbandSheetQuery } from "@/features/warbands/api/warband-queries";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

/**
 * Starting a battle readies you up: your open post-game, if you have one, is
 * finalised with the draft you saved (as Ready at camp would), then the battle is created. Never
 * a block: if the post-game can't be finalised it stays open, the battle starts anyway and a
 * warning says so.
 */
export function useReadyUpBeforeStart(campaignId: number, userId: number | undefined) {
  const queryClient = useQueryClient();
  const { data } = useOpenCampaignBattles(campaignId);
  const openPostgame =
    (data ?? []).find((state) => state.viewer?.participant_status === "finished_battle") ?? null;

  const readyUp = async () => {
    if (!openPostgame) return;
    const mine = openPostgame.participants.find((entry) => entry.user.id === userId);
    try {
      const answer = await finalizeBattlePostbattle(campaignId, openPostgame.battle.id);
      toastBattleWarnings(answer.warnings);
      if (mine) {
        const warbandId = mine.warband.id;
        void queryClient.invalidateQueries({
          queryKey: queryKeys.campaign.warband(campaignId, warbandId),
        });
        void queryClient.invalidateQueries({
          queryKey: warbandSheetQuery(campaignId, warbandId).queryKey,
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.players(campaignId) });
      void invalidateOpenBattles(queryClient, campaignId);
    } catch (error) {
      toast.warning("Your post-game is still open; the battle starts anyway.", {
        description: getErrorMessage(error),
      });
    }
  };

  return { openPostgame, readyUp };
}
