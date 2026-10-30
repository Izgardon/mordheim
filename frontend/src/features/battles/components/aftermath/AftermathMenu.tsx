import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MoreMenu } from "@/components/ui/more-menu";
import { confirmBattlePostbattle } from "@/features/battles/api/battles-api";
import { useClosePostbattle } from "@/features/battles/hooks/useClosePostbattle";
import { useRefreshOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import type { PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppStore } from "@/stores/app-store";

/**
 * The Aftermath's ⋯ menu: Skip post-battle (your part done, nothing from the page applied) and,
 * for the battle's creator or a battle manager, Close post-battle (ends it for everyone still in
 * theirs, BUG-09). Both ask first; the page then leaves for the warband.
 */
export default function AftermathMenu({
  battle,
  battleState,
}: {
  battle: PostgameBattle;
  battleState: BattleState;
}) {
  const campaignId = battleState.battle.campaign_id;
  const battleId = battleState.battle.id;
  const { clearCurrentBattleSession } = useAppStore();
  const refreshOpenBattles = useRefreshOpenBattles(campaignId);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState("");
  const done = (next: BattleState) => {
    clearCurrentBattleSession();
    void refreshOpenBattles();
    battle.applyBattleResponse(next);
  };
  const closing = useClosePostbattle({ campaignId, battleId, onClosed: done });

  const skip = async () => {
    setSkipping(true);
    setSkipError("");
    try {
      const next = await confirmBattlePostbattle(campaignId, battleId);
      setSkipOpen(false);
      done(next);
    } catch (error) {
      setSkipError(getErrorMessage(error, "Unable to skip the post-battle"));
    } finally {
      setSkipping(false);
    }
  };

  return (
    <>
      <MoreMenu
        label="More post-battle actions"
        entries={[
          { label: "Skip post-battle", onSelect: () => setSkipOpen(true) },
          ...(battle.capabilities?.close_postbattle
            ? [{ label: "Close post-battle", onSelect: () => closing.openChange(true) }]
            : []),
        ]}
      />
      <ConfirmDialog
        open={skipOpen}
        onOpenChange={(open) => {
          setSkipOpen(open);
          setSkipError("");
        }}
        title="Skip post-battle"
        description="Skip your post-battle? Nothing from this page is applied: no experience, injuries, finds or shards. You are ready for the next battle."
        confirmText={skipping ? "Skipping…" : "Skip post-battle"}
        isConfirming={skipping}
        error={skipError}
        onConfirm={() => void skip()}
      />
      <ConfirmDialog
        open={closing.isOpen}
        onOpenChange={closing.openChange}
        title="Close post-battle"
        description="Close the post-battle for everyone? Players who haven't finished theirs keep nothing from it, and the battle ends."
        confirmText={closing.isClosing ? "Closing…" : "Close post-battle"}
        isConfirming={closing.isClosing}
        error={closing.error}
        onConfirm={() => void closing.close()}
      />
    </>
  );
}
