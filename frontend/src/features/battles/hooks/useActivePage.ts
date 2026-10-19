import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { recordUnitKill, setUnitOutOfAction } from "@/features/battles/api/battles-api";
import { buildBattleUnitOptions } from "@/features/battles/components/active/active-utils";
import { useActiveConfigSave } from "@/features/battles/hooks/useActiveConfigSave";
import { useBattleNotesDialog } from "@/features/battles/hooks/useBattleNotesDialog";
import { useCreatorCancel } from "@/features/battles/hooks/useCreatorCancel";
import { useEventUndo } from "@/features/battles/hooks/useEventUndo";
import { useFinishMine } from "@/features/battles/hooks/useFinishMine";
import { useParticipantSelection } from "@/features/battles/hooks/useParticipantSelection";
import {
  useSingleUseItemActions,
  useUsedSingleUseItems,
} from "@/features/battles/hooks/useUsedSingleUseItems";
import { useBattle } from "@/features/battles/state/battle-context";
import { newestOwnEvent } from "@/features/battles/utils/battle-events";
import { meleeUnitOptions, rangedUnitOptions } from "@/features/battles/utils/helper-options";

export type ActiveHelper = "melee" | "ranged" | "critical";

type KillInput = {
  killerUnitKey: string;
  victimUnitKey?: string;
  victimName?: string;
  notes?: string;
  earnedXp: boolean;
};

/**
 * Everything the active page shows and does, from the battle `BattleLayout` shares: whose
 * warband is shown, config saves, kills and out of action, item uses, Finish my battle and Cancel, the
 * helpers' unit lists and the page's dialogs.
 */
export function useActivePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const battle = useBattle();
  const { campaignId, battleId, battleState, applyBattleResponse, rosters } = battle;
  const { participants, events } = battleState;

  const selection = useParticipantSelection(participants, user?.id);
  const { currentParticipant } = selection;
  const config = useActiveConfigSave({ battle, userId: user?.id, rosters });
  const getUsedSingleUseItemCount = useUsedSingleUseItems(events);
  const items = useSingleUseItemActions({
    campaignId,
    battleId,
    events,
    currentParticipant,
    userId: user?.id,
    applyBattleResponse,
    setActionError: config.setActionError,
  });
  const { offerUndo } = useEventUndo({ campaignId, battleId, applyBattleResponse });
  const finishing = useFinishMine({ campaignId, battleId, applyBattleResponse });
  const creatorCancel = useCreatorCancel({ campaignId, battleId, applyBattleResponse });
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isScenarioLinkDialogOpen, setIsScenarioLinkDialogOpen] = useState(false);
  const [isBattleNotesOpen, setIsBattleNotesOpen] = useBattleNotesDialog(
    selection.selectedParticipantIsCurrentUser
  );
  const [openHelper, setOpenHelper] = useState<ActiveHelper | null>(null);

  const currentUserId = currentParticipant?.user.id;
  const killTargetOptions = useMemo(
    () =>
      buildBattleUnitOptions(participants, rosters).filter(
        (option) => option.participantUserId !== currentUserId
      ),
    [currentUserId, participants, rosters]
  );
  const meleeOptions = useMemo(
    () => meleeUnitOptions(participants, rosters, currentUserId),
    [currentUserId, participants, rosters]
  );
  const rangedOptions = useMemo(
    () => rangedUnitOptions(currentParticipant, rosters),
    [currentParticipant, rosters]
  );

  const setOutOfAction = useCallback(
    async (unitKey: string, outOfAction: boolean) => {
      applyBattleResponse(
        await setUnitOutOfAction(campaignId, battleId, {
          unit_key: unitKey,
          out_of_action: outOfAction,
        })
      );
    },
    [applyBattleResponse, battleId, campaignId]
  );

  const recordKill = useCallback(
    async (kill: KillInput) => {
      const next = await recordUnitKill(campaignId, battleId, {
        killer_unit_key: kill.killerUnitKey,
        victim_unit_key: kill.victimUnitKey,
        victim_name: kill.victimName,
        notes: kill.notes,
        earned_xp: kill.earnedXp,
      });
      applyBattleResponse(next);
      // A mis-tapped kill can be undone at once, or from postbattle until you finalise (BUG-11).
      offerUndo("Kill recorded.", newestOwnEvent(next.events, "unit_kill_recorded", user?.id)?.id);
    },
    [applyBattleResponse, battleId, campaignId, offerUndo, user?.id]
  );

  const isActiveCreator =
    battleState.battle.status === "active" && battleState.battle.created_by_user_id === user?.id;

  const leaveBattle = useCallback(() => {
    setIsLeaveDialogOpen(false);
    navigate(`/campaigns/${campaignId}`);
  }, [campaignId, navigate]);

  return {
    user,
    battle,
    selection,
    config,
    getUsedSingleUseItemCount,
    items,
    finishing,
    creatorCancel,
    killTargetOptions,
    meleeOptions,
    rangedOptions,
    setOutOfAction,
    recordKill,
    // The server's capabilities decide Finish my battle and Cancel; without them, the old rules.
    canFinishMine: battle.capabilities
      ? Boolean(battle.capabilities.finish_mine)
      : battleState.battle.status === "active" && currentParticipant?.status === "in_battle",
    canCancelBattle: battle.capabilities ? battle.capabilities.cancel : isActiveCreator,
    leave: { isOpen: isLeaveDialogOpen, setIsOpen: setIsLeaveDialogOpen, confirm: leaveBattle },
    scenarioDialog: { isOpen: isScenarioLinkDialogOpen, setIsOpen: setIsScenarioLinkDialogOpen },
    notesDialog: { isOpen: isBattleNotesOpen, setIsOpen: setIsBattleNotesOpen },
    helper: { open: openHelper, setOpen: setOpenHelper },
  };
}

export type ActivePage = ReturnType<typeof useActivePage>;
