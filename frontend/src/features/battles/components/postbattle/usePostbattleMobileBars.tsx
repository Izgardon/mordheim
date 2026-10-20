import { useEffect, useMemo } from "react";

import type { BattleLayoutContext } from "@/features/battles/components/layout/battle-shell-types";
import BattleTopBarActions from "@/features/battles/components/shared/BattleTopBarActions";
import type { BattleOverflowAction } from "@/features/battles/components/shared/BattleOverflowMenu";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

type SectionOption = { value: string; label: string };

/**
 * Postbattle's phone bars: the top bar's section picker, Battle Notes and More actions (Skip and
 * Close postbattle); Finalise as the bottom bar's one action. While the page waits for the others
 * (`waiting`, BATL-NEW-08) there are no sections to pick and nothing to finalise.
 */
export function usePostbattleMobileBars({
  isMobile,
  currentParticipant,
  setBattleMobileTopBar,
  setBattleMobileBottomBar,
  onBack,
  onOpenNotes,
  overflowActions,
  sectionOptions,
  selectedSection,
  onSectionChange,
  finalise,
  waiting = false,
}: Pick<BattleLayoutContext, "setBattleMobileTopBar" | "setBattleMobileBottomBar"> & {
  isMobile: boolean;
  currentParticipant: BattleParticipant | null;
  onBack: () => void;
  onOpenNotes: () => void;
  overflowActions: BattleOverflowAction[];
  sectionOptions: SectionOption[];
  selectedSection: string;
  onSectionChange: (value: string) => void;
  finalise: { label: string; disabled: boolean; onOpen: () => void };
  waiting?: boolean;
}) {
  const extraActions = useMemo(
    () => <BattleTopBarActions onOpenNotes={onOpenNotes} overflowActions={overflowActions} />,
    [onOpenNotes, overflowActions]
  );
  const { label: finaliseLabel, disabled: finaliseDisabled, onOpen: openFinalise } = finalise;

  useEffect(() => {
    if (!isMobile || !currentParticipant) {
      setBattleMobileTopBar?.(null);
      setBattleMobileBottomBar?.(null);
      return;
    }

    setBattleMobileTopBar?.({
      title: "Postbattle",
      onBack,
      extraActions,
      unitTypeOptions: waiting ? [] : sectionOptions,
      selectedUnitTypeValue: selectedSection,
      onUnitTypeChange: onSectionChange,
    });
    setBattleMobileBottomBar?.(
      waiting
        ? null
        : {
            primaryAction: {
              label: finaliseLabel,
              onClick: openFinalise,
              disabled: finaliseDisabled,
              variant: "default",
            },
          }
    );

    return () => {
      setBattleMobileTopBar?.(null);
      setBattleMobileBottomBar?.(null);
    };
  }, [
    currentParticipant,
    extraActions,
    finaliseDisabled,
    finaliseLabel,
    isMobile,
    onBack,
    onSectionChange,
    openFinalise,
    sectionOptions,
    selectedSection,
    setBattleMobileBottomBar,
    setBattleMobileTopBar,
    waiting,
  ]);
}
