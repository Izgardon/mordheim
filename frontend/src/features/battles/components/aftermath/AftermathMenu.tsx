import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MoreMenu } from "@/components/ui/more-menu";
import { confirmBattlePostbattle } from "@/features/battles/api/battles-api";
import { useRefreshOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import type { PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppStore } from "@/stores/app-store";

/**
 * The Aftermath's ⋯ menu: Skip aftermath, which finishes your part of the battle (William,
 * 18 Nov 2026: "skip post battle should just become skip aftermath"). It asks first; the page then
 * leaves for the warband. Nobody ends another player's post-battle from here: closing one is a
 * battle manager's, in Settings → Battles.
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

  const skip = async () => {
    setSkipping(true);
    setSkipError("");
    try {
      const next = await confirmBattlePostbattle(campaignId, battleId);
      setSkipOpen(false);
      done(next);
    } catch (error) {
      setSkipError(getErrorMessage(error, "Unable to skip the aftermath"));
    } finally {
      setSkipping(false);
    }
  };
  // What a Next has already handed over stays in the warband; only the rest is given up.
  const applied = battle.participant?.postbattle_json?.aftermath?.applied ?? [];
  const kept = applied.length ? " The steps you have already confirmed stay in your warband." : "";

  return (
    <>
      <MoreMenu
        label="More post-battle actions"
        entries={[{ label: "Skip aftermath", onSelect: () => setSkipOpen(true) }]}
      />
      <ConfirmDialog
        open={skipOpen}
        onOpenChange={(open) => {
          setSkipOpen(open);
          setSkipError("");
        }}
        title="Skip aftermath"
        description={`Skip the rest of your aftermath? Nothing else from this page is applied: no experience, injuries, finds or shards.${kept} You are ready for the next battle.`}
        confirmText={skipping ? "Skipping…" : "Skip aftermath"}
        isConfirming={skipping}
        error={skipError}
        onConfirm={() => void skip()}
      />
    </>
  );
}
