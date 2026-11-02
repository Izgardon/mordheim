import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useRefreshOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { invalidatePendingResults } from "@/features/battles/hooks/usePendingReportedResults";
import { queryKeys } from "@/lib/query-keys";

import { useCampaignPlayers } from "../../api/campaign-queries";
import type { BattleDialogMode } from "../../hooks/overview/useStartBattleForm";
import StartBattleDialog from "../overview/StartBattleDialog";

/**
 * Start battle and Report a result, mounted once by the campaign layout so they open from any of
 * its pages (the overview's header, the phone's Battle). The players are read once it opens; the
 * overview has them already.
 */
export default function CampaignBattleDialog({
  campaignId,
  mode,
  onClose,
}: {
  campaignId: number;
  mode: BattleDialogMode | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const refreshOpenBattles = useRefreshOpenBattles(campaignId);
  const players = useCampaignPlayers(campaignId, { enabled: mode !== null }).data ?? [];
  if (!user) return null;

  const created = () => {
    void refreshOpenBattles();
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.players(campaignId) });
    void invalidatePendingResults(queryClient, campaignId);
  };
  return (
    <StartBattleDialog
      mode={mode}
      onClose={onClose}
      campaignId={campaignId}
      userId={user.id}
      players={players}
      onCreated={created}
    />
  );
}
