import { useCallback, useMemo } from "react";

import type { BattleLayoutContext } from "@/features/battles/components/layout/battle-shell-types";
import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import BattleTopBarActions from "@/features/battles/components/shared/BattleTopBarActions";
import {
  useBattleMobileBottomBar,
  useBattleMobileTopBar,
} from "@/features/battles/components/shared/useBattleMobileBars";
import type { ActivePage } from "@/features/battles/hooks/useActivePage";

/**
 * The active page's phone bars and shared actions: the top bar (notes, scenario, More actions with
 * Cancel battle), and End Battle as the bottom bar's one action (BATL-UX-05).
 */
export function useActiveMobileBars({
  page,
  isMobile,
  selectedCustomUnits,
  setBattleMobileTopBar,
  setBattleMobileBottomBar,
}: {
  page: ActivePage;
  isMobile: boolean;
  selectedCustomUnits: PrebattleUnit[];
} & Pick<BattleLayoutContext, "setBattleMobileTopBar" | "setBattleMobileBottomBar">) {
  const { selection, creatorCancel, finishing, canEndBattle, canCancelBattle } = page;
  const scenarioLink = page.battle.battleState.battle.scenario_link;
  const isOwnSelected = selection.selectedParticipantIsCurrentUser;
  const { setIsOpen: setNotesOpen } = page.notesDialog;
  const { setIsOpen: setScenarioOpen } = page.scenarioDialog;
  const { setIsOpen: openCancel, isCanceling } = creatorCancel;
  const { setIsOpen: openFinish, isFinishing } = finishing;
  const openNotes = useCallback(() => setNotesOpen(true), [setNotesOpen]);
  const openScenario = useCallback(() => setScenarioOpen(true), [setScenarioOpen]);

  // Cancel battle sits in More actions, away from End battle, the normal path (BATL-UX-05).
  const overflowActions = useMemo(
    () =>
      canCancelBattle
        ? [
            {
              label: isCanceling ? "Canceling..." : "Cancel battle",
              onSelect: () => openCancel(true),
              disabled: isCanceling,
              destructive: true,
            },
          ]
        : [],
    [canCancelBattle, isCanceling, openCancel]
  );
  const extraActions = useMemo(
    () =>
      isOwnSelected || scenarioLink || overflowActions.length > 0 ? (
        <BattleTopBarActions
          onOpenNotes={isOwnSelected ? openNotes : undefined}
          onOpenScenario={scenarioLink ? openScenario : undefined}
          overflowActions={overflowActions}
        />
      ) : null,
    [isOwnSelected, openNotes, openScenario, overflowActions, scenarioLink]
  );
  const { selectedParticipant } = selection;
  const { sectionIdByKey } = useBattleMobileTopBar({
    isMobile,
    setBattleMobileTopBar,
    title: "In Battle",
    onBack: () => page.leave.setIsOpen(true),
    extraActions,
    statusParticipants: selection.statusParticipants,
    selectedParticipant,
    selectedParticipantRoster: selectedParticipant
      ? page.battle.rosters[selectedParticipant.user.id]
      : undefined,
    selectedParticipantCustomUnits: selectedCustomUnits,
    onSelectParticipantUserId: selection.setSelectedParticipantUserId,
  });

  const endBattleAction = useMemo(
    () => ({
      label: isFinishing ? "Ending..." : "End Battle",
      onClick: () => openFinish(true),
      disabled: isFinishing,
      variant: "default" as const,
    }),
    [isFinishing, openFinish]
  );
  const bottomBarConfig = useMemo(
    () => (canEndBattle ? { primaryAction: endBattleAction } : null),
    [canEndBattle, endBattleAction]
  );
  useBattleMobileBottomBar({ isMobile, setBattleMobileBottomBar, config: bottomBarConfig });

  return { sectionIdByKey, overflowActions, endBattleAction, openNotes, openScenario };
}
