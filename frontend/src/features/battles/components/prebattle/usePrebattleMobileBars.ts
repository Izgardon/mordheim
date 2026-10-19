import { useMemo } from "react";

import type { BattleLayoutContext } from "@/features/battles/components/layout/battle-shell-types";
import { useBattleMobileBottomBar } from "@/features/battles/components/shared/useBattleMobileBars";

export {
  getUnitSectionId,
  UNIT_SECTION_LABELS,
  useBattleMobileTopBar as usePrebattleMobileTopBar,
} from "@/features/battles/components/shared/useBattleMobileBars";
export type { UnitSectionKey } from "@/features/battles/components/shared/useBattleMobileBars";

type UsePrebattleMobileBottomBarParams = {
  isMobile: boolean;
  setBattleMobileBottomBar?: BattleLayoutContext["setBattleMobileBottomBar"];
  isUpdatingReady: boolean;
  currentUserReady: boolean;
  readyDisabled: boolean;
  onToggleReady: () => void;
  /** Start battle is offered (the creator's, or anyone's the server lets start). */
  showStart: boolean;
  isStartingBattle: boolean;
  startDisabled: boolean;
  canCreatorCancelBattle: boolean;
  isCancelingBattle: boolean;
  onOpenStart: () => void;
  onOpenCancel: () => void;
};

export function usePrebattleMobileBottomBar({
  isMobile,
  setBattleMobileBottomBar,
  isUpdatingReady,
  currentUserReady,
  readyDisabled,
  onToggleReady,
  showStart,
  isStartingBattle,
  startDisabled,
  canCreatorCancelBattle,
  isCancelingBattle,
  onOpenStart,
  onOpenCancel,
}: UsePrebattleMobileBottomBarParams) {
  const config = useMemo(() => {
    return {
      primaryAction: {
        label: isUpdatingReady ? "Updating..." : currentUserReady ? "Undo Ready" : "Ready Up",
        onClick: onToggleReady,
        disabled: readyDisabled,
        variant: "secondary" as const,
      },
      secondaryAction:
        showStart && currentUserReady
          ? {
              label: isStartingBattle ? "Starting..." : "Start battle",
              onClick: onOpenStart,
              disabled: startDisabled,
              variant: "default" as const,
            }
          : canCreatorCancelBattle
            ? {
                label: isCancelingBattle ? "Canceling..." : "Cancel battle",
                onClick: onOpenCancel,
                disabled: isCancelingBattle,
                variant: "destructive" as const,
              }
            : undefined,
    };
  }, [
    canCreatorCancelBattle,
    currentUserReady,
    isCancelingBattle,
    isStartingBattle,
    isUpdatingReady,
    onOpenCancel,
    onOpenStart,
    onToggleReady,
    readyDisabled,
    showStart,
    startDisabled,
  ]);

  useBattleMobileBottomBar({
    isMobile,
    setBattleMobileBottomBar,
    config,
  });
}
