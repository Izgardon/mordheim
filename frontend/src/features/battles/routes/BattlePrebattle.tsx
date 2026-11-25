import { useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import BattleInvitation from "@/features/battles/components/prebattle/BattleInvitation";
import PrebattleBody from "@/features/battles/components/prebattle/PrebattleBody";
import BattleNotesSheet from "@/features/battles/components/shared/BattleNotesSheet";
import { usePrebattlePage } from "@/features/battles/hooks/usePrebattlePage";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * `battles/:battleId/prebattle`: the invitation while the battle is gathering its
 * players, then the pre-battle. On a phone the battle bar's Menu carries notes, leaving and the
 * creator's Cancel.
 */
export default function BattlePrebattle() {
  const { setBattleMenuActions, setBattleRules } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const page = usePrebattlePage();
  const { flags, creatorCancel, start, notesDialog, ready, leave, selection } = page;
  const me = selection.currentParticipant;
  const openNotes = notesDialog.setIsOpen;
  const confirmLeave = leave.confirm;
  const openCancel = creatorCancel.setIsOpen;
  const canCancel = flags.canCreatorCancelBattle;
  const hasMe = Boolean(me);

  useEffect(() => {
    setBattleMenuActions([
      ...(hasMe
        ? [
            {
              label: "Battle notes",
              detail: "Your own notes for this fight; only you see them",
              onSelect: () => openNotes(true),
            },
          ]
        : []),
      ...(canCancel
        ? [
            {
              label: "Cancel battle",
              detail: "For everyone; nothing is kept",
              onSelect: () => openCancel(true),
              danger: true,
            },
          ]
        : []),
      {
        label: "Leave",
        detail: "Step out of this battle; your Ready is taken back",
        onSelect: confirmLeave,
        danger: true,
      },
    ]);
    return () => setBattleMenuActions([]);
  }, [canCancel, confirmLeave, hasMe, openCancel, openNotes, setBattleMenuActions]);

  // the phone bar's Rules sheet, as the active battle's: its scenario and its warbands' rules
  const { battle: info, participants } = page.battle.battleState;
  const rules = useMemo(
    () => ({
      scenario: { name: info.scenario, id: info.scenario_id },
      warbands: participants.map((participant) => participant.warband),
    }),
    [info.scenario, info.scenario_id, participants]
  );
  useEffect(() => {
    setBattleRules(rules);
    return () => setBattleRules(null);
  }, [rules, setBattleRules]);

  return (
    <>
      {flags.invitePending ? (
        <BattleInvitation page={page} />
      ) : (
        <PrebattleBody page={page} isMobile={isMobile} onOpenNotes={() => openNotes(true)} />
      )}
      <ConfirmDialog
        open={start.isOpen}
        onOpenChange={start.openChange}
        description={flags.startQuestion}
        confirmText="Start battle"
        confirmVariant="primary"
        isConfirming={start.isStarting}
        error={start.error}
        onConfirm={() => void start.start()}
      />
      <ConfirmDialog
        open={creatorCancel.isOpen}
        onOpenChange={(open) => {
          creatorCancel.setIsOpen(open);
          if (!open) creatorCancel.setError("");
        }}
        description="Cancel this battle for everyone? Nothing in it is kept."
        confirmText="Cancel battle"
        cancelText="Keep it"
        isConfirming={creatorCancel.isCanceling}
        error={creatorCancel.error}
        onConfirm={() => void creatorCancel.cancel()}
      />
      {me ? (
        <BattleNotesSheet
          open={notesDialog.isOpen}
          onOpenChange={notesDialog.setIsOpen}
          notes={page.yourNotes}
          onSave={ready.saveBattleNotes}
        />
      ) : null}
    </>
  );
}
