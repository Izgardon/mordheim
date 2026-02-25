import { useMemo } from "react";

import type { BattleLayoutContext } from "@/features/battles/routes/BattleLayout";
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
  isBattleCreator: boolean;
  isStartingBattle: boolean;
  startDisabled: boolean;
  canCreatorCancelBattle: boolean;
  isCancelingBattle: boolean;
  onOpenLeave: () => void;
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
  isBattleCreator,
  isStartingBattle,
  startDisabled,
  canCreatorCancelBattle,
  isCancelingBattle,
  onOpenLeave,
  onOpenStart,
  onOpenCancel,
}: UsePrebattleMobileBottomBarParams) {
  const config = useMemo(() => {
    return {
      leftAction: {
        label: "Leave",
        onClick: onOpenLeave,
        variant: "secondary" as const,
      },
      primaryAction: {
        label: isUpdatingReady ? "Updating..." : currentUserReady ? "Undo Ready" : "Ready Up",
        onClick: onToggleReady,
        disabled: readyDisabled,
        variant: "secondary" as const,
      },
      secondaryAction: isBattleCreator
        ? currentUserReady
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
            : undefined
        : undefined,
    };
  }, [
    canCreatorCancelBattle,
    currentUserReady,
    isBattleCreator,
    isCancelingBattle,
    isStartingBattle,
    isUpdatingReady,
    onOpenCancel,
    onOpenLeave,
    onOpenStart,
    onToggleReady,
    readyDisabled,
    startDisabled,
  ]);

  useBattleMobileBottomBar({
    isMobile,
    setBattleMobileBottomBar,
    config,
  });
}
