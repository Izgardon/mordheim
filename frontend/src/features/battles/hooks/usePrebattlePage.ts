import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useBattleNotesDialog } from "@/features/battles/hooks/useBattleNotesDialog";
import { useCreatorCancel } from "@/features/battles/hooks/useCreatorCancel";
import { useDeclineInvite } from "@/features/battles/hooks/useDeclineInvite";
import { useRefreshOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { useParticipantSelection } from "@/features/battles/hooks/useParticipantSelection";
import { usePrebattleConfig } from "@/features/battles/hooks/usePrebattleConfig";
import { usePrebattleRatings } from "@/features/battles/hooks/usePrebattleRatings";
import { usePrebattleReady } from "@/features/battles/hooks/usePrebattleReady";
import { usePrebattleStart } from "@/features/battles/hooks/usePrebattleStart";
import { usePrebattleVisibleConfig } from "@/features/battles/hooks/usePrebattleVisibleConfig";
import { useUnreadyOnExit } from "@/features/battles/hooks/useUnreadyOnExit";
import {
  useSingleUseItemActions,
  useUsedSingleUseItems,
} from "@/features/battles/hooks/useUsedSingleUseItems";
import { useBattle } from "@/features/battles/state/battle-context";
import { prebattleFlags } from "@/features/battles/utils/prebattle-flags";

/**
 * Everything the prebattle page shows and does, from the battle `BattleLayout` shares: whose
 * warband is shown, your form and ratings, Ready Up, Start and Cancel, item uses, Decline, and the
 * page's dialogs.
 */
export function usePrebattlePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const battle = useBattle();
  const { campaignId, battleId, battleState, applyBattleResponse, rosters } = battle;
  const { participants, events } = battleState;

  const selection = useParticipantSelection(participants, user?.id);
  const { currentParticipant, selectedParticipant } = selection;
  const isOwnSelected = selection.selectedParticipantIsCurrentUser;
  useUnreadyOnExit({
    campaignId,
    battleId,
    battleStateRef: battle.battleStateRef,
    userId: user?.id,
  });
  const config = usePrebattleConfig({
    battleId,
    currentParticipant,
    ownRoster: currentParticipant ? rosters[currentParticipant.user.id] : undefined,
    currentUserReady: currentParticipant?.status === "ready",
  });
  const ratings = usePrebattleRatings(participants, currentParticipant, config.customUnits);
  const ready = usePrebattleReady({
    campaignId,
    battleId,
    battleState,
    currentParticipant,
    config,
    declaredRating: ratings.currentDeclaredRating,
    applyBattleResponse,
  });
  const visible = usePrebattleVisibleConfig(selectedParticipant, isOwnSelected, config);
  const getUsedSingleUseItemCount = useUsedSingleUseItems(events);
  const items = useSingleUseItemActions({
    campaignId,
    battleId,
    events,
    currentParticipant,
    userId: user?.id,
    applyBattleResponse,
    setActionError: ready.setActionError,
  });
  const start = usePrebattleStart({ campaignId, battleId, applyBattleResponse });
  const creatorCancel = useCreatorCancel({ campaignId, battleId, applyBattleResponse });
  const refreshOpenBattles = useRefreshOpenBattles(campaignId);
  const declining = useDeclineInvite({
    campaignId,
    battleId,
    onDeclined: useCallback(() => {
      void refreshOpenBattles();
      navigate(`/campaigns/${campaignId}`);
    }, [campaignId, navigate, refreshOpenBattles]),
  });
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isScenarioLinkDialogOpen, setIsScenarioLinkDialogOpen] = useState(false);
  const [isBattleNotesOpen, setIsBattleNotesOpen] = useBattleNotesDialog(isOwnSelected);

  const flags = prebattleFlags({
    battleState,
    capabilities: battle.capabilities,
    currentParticipant,
    userId: user?.id,
    isOwnSelected,
    isUpdatingReady: ready.isUpdatingReady,
    isSavingConfig: ready.isSavingConfig,
    isStartingBattle: start.isStarting,
  });

  const leaveBattle = useCallback(() => {
    setIsLeaveDialogOpen(false);
    navigate(`/campaigns/${campaignId}`);
  }, [campaignId, navigate]);

  return {
    battle,
    selection,
    isOwnSelected,
    config,
    ratings,
    ready,
    visible,
    getUsedSingleUseItemCount,
    items,
    start,
    creatorCancel,
    declining,
    flags,
    leave: { isOpen: isLeaveDialogOpen, setIsOpen: setIsLeaveDialogOpen, confirm: leaveBattle },
    scenarioDialog: { isOpen: isScenarioLinkDialogOpen, setIsOpen: setIsScenarioLinkDialogOpen },
    notesDialog: { isOpen: isBattleNotesOpen, setIsOpen: setIsBattleNotesOpen },
  };
}
