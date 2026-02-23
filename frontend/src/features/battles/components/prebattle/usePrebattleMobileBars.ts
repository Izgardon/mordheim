import { useCallback, useEffect, useMemo, useState } from "react";

import type { BattleParticipant } from "@/features/battles/types/battle-types";
import type { BattleLayoutContext } from "@/features/battles/routes/BattleLayout";

import type { ParticipantRoster, PrebattleUnit } from "./prebattle-types";

export type UnitSectionKey = "heroes" | "henchmen" | "hired_swords" | "temporary";

export const UNIT_SECTION_LABELS: Record<UnitSectionKey, string> = {
  heroes: "Heroes",
  henchmen: "Henchmen",
  hired_swords: "Hired Swords",
  temporary: "Temporary",
};

export function getUnitSectionId(participantUserId: number, section: UnitSectionKey) {
  return `battle-participant-${participantUserId}-section-${section}`;
}

type UsePrebattleMobileTopBarParams = {
  isMobile: boolean;
  setBattleMobileTopBar?: BattleLayoutContext["setBattleMobileTopBar"];
  statusParticipants: BattleParticipant[];
  selectedParticipant: BattleParticipant | null;
  selectedParticipantRoster?: ParticipantRoster;
  selectedParticipantCustomUnits: PrebattleUnit[];
  onSelectParticipantUserId: (userId: number) => void;
};

export function usePrebattleMobileTopBar({
  isMobile,
  setBattleMobileTopBar,
  statusParticipants,
  selectedParticipant,
  selectedParticipantRoster,
  selectedParticipantCustomUnits,
  onSelectParticipantUserId,
}: UsePrebattleMobileTopBarParams) {
  const [selectedUnitSection, setSelectedUnitSection] = useState<UnitSectionKey>("heroes");

  const unitSectionOptions = useMemo(() => {
    const options: { value: UnitSectionKey; label: string }[] = [];
    if (selectedParticipantRoster?.heroes.length) {
      options.push({ value: "heroes", label: UNIT_SECTION_LABELS.heroes });
    }
    if (selectedParticipantRoster?.henchmenGroups.length) {
      options.push({ value: "henchmen", label: UNIT_SECTION_LABELS.henchmen });
    }
    if (selectedParticipantRoster?.hiredSwords.length) {
      options.push({ value: "hired_swords", label: UNIT_SECTION_LABELS.hired_swords });
    }
    if (selectedParticipantCustomUnits.length) {
      options.push({ value: "temporary", label: UNIT_SECTION_LABELS.temporary });
    }
    return options;
  }, [selectedParticipantCustomUnits.length, selectedParticipantRoster]);

  const sectionIdByKey = useMemo(() => {
    if (!selectedParticipant) {
      return {};
    }
    return {
      heroes: getUnitSectionId(selectedParticipant.user.id, "heroes"),
      henchmen: getUnitSectionId(selectedParticipant.user.id, "henchmen"),
      hired_swords: getUnitSectionId(selectedParticipant.user.id, "hired_swords"),
      temporary: getUnitSectionId(selectedParticipant.user.id, "temporary"),
    };
  }, [selectedParticipant]);

  const scrollPageToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleUnitSectionChange = useCallback(
    (nextSectionValue: string) => {
      if (!selectedParticipant) {
        return;
      }
      const sectionKey = nextSectionValue as UnitSectionKey;
      setSelectedUnitSection(sectionKey);
      const sectionId = getUnitSectionId(selectedParticipant.user.id, sectionKey);
      const sectionElement = document.getElementById(sectionId);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [selectedParticipant]
  );

  const handleWarbandSelectionChange = useCallback(
    (nextUserIdValue: string) => {
      const nextUserId = Number(nextUserIdValue);
      if (!Number.isFinite(nextUserId)) {
        return;
      }
      onSelectParticipantUserId(nextUserId);
      const defaultSection =
        unitSectionOptions.find((option) => option.value === "heroes")?.value ??
        unitSectionOptions[0]?.value ??
        "heroes";
      setSelectedUnitSection(defaultSection);
      scrollPageToTop();
    },
    [onSelectParticipantUserId, scrollPageToTop, unitSectionOptions]
  );

  useEffect(() => {
    const validValues = new Set(unitSectionOptions.map((option) => option.value));
    if (validValues.size === 0) {
      if (selectedUnitSection !== "heroes") {
        setSelectedUnitSection("heroes");
      }
      return;
    }
    if (!validValues.has(selectedUnitSection)) {
      setSelectedUnitSection(unitSectionOptions[0].value);
    }
  }, [selectedUnitSection, unitSectionOptions]);

  useEffect(() => {
    if (!selectedParticipant) {
      return;
    }
    const defaultSection =
      unitSectionOptions.find((option) => option.value === "heroes")?.value ??
      unitSectionOptions[0]?.value ??
      "heroes";
    setSelectedUnitSection(defaultSection);
    scrollPageToTop();
  }, [selectedParticipant?.user.id, scrollPageToTop, unitSectionOptions]);

  useEffect(() => {
    if (!isMobile || !selectedParticipant || unitSectionOptions.length === 0) {
      return;
    }

    const topOffset = 116;
    let frameHandle = 0;

    const syncSectionFromScroll = () => {
      frameHandle = 0;

      let nextSection: UnitSectionKey | null = null;
      let bestPassedTop = Number.NEGATIVE_INFINITY;

      for (const option of unitSectionOptions) {
        const sectionId = getUnitSectionId(selectedParticipant.user.id, option.value);
        const sectionElement = document.getElementById(sectionId);
        if (!sectionElement) {
          continue;
        }
        const sectionTop = sectionElement.getBoundingClientRect().top - topOffset;
        if (sectionTop <= 0 && sectionTop > bestPassedTop) {
          bestPassedTop = sectionTop;
          nextSection = option.value;
        }
      }

      if (!nextSection) {
        let nearestAboveFold = Number.POSITIVE_INFINITY;
        for (const option of unitSectionOptions) {
          const sectionId = getUnitSectionId(selectedParticipant.user.id, option.value);
          const sectionElement = document.getElementById(sectionId);
          if (!sectionElement) {
            continue;
          }
          const sectionTop = sectionElement.getBoundingClientRect().top - topOffset;
          if (sectionTop >= 0 && sectionTop < nearestAboveFold) {
            nearestAboveFold = sectionTop;
            nextSection = option.value;
          }
        }
      }

      if (!nextSection) {
        nextSection = unitSectionOptions[0].value;
      }

      setSelectedUnitSection((prev) => (prev === nextSection ? prev : nextSection));
    };

    const onScroll = () => {
      if (frameHandle !== 0) {
        return;
      }
      frameHandle = window.requestAnimationFrame(syncSectionFromScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (frameHandle !== 0) {
        window.cancelAnimationFrame(frameHandle);
      }
    };
  }, [isMobile, selectedParticipant, unitSectionOptions]);

  useEffect(() => {
    if (!isMobile || !setBattleMobileTopBar) {
      return;
    }
    if (!selectedParticipant) {
      setBattleMobileTopBar(null);
      return;
    }

    const warbandOptions = statusParticipants.map((participant) => ({
      value: String(participant.user.id),
      label: participant.warband.name,
    }));

    setBattleMobileTopBar({
      warbandOptions,
      selectedWarbandValue: String(selectedParticipant.user.id),
      onWarbandChange: handleWarbandSelectionChange,
      unitTypeOptions: unitSectionOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
      selectedUnitTypeValue: selectedUnitSection,
      onUnitTypeChange: handleUnitSectionChange,
    });

    return () => {
      setBattleMobileTopBar(null);
    };
  }, [
    handleUnitSectionChange,
    handleWarbandSelectionChange,
    isMobile,
    selectedParticipant,
    selectedUnitSection,
    setBattleMobileTopBar,
    statusParticipants,
    unitSectionOptions,
  ]);

  return {
    sectionIdByKey,
  };
}

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
  useEffect(() => {
    if (!isMobile || !setBattleMobileBottomBar) {
      return;
    }

    setBattleMobileBottomBar({
      leftAction: {
        label: "Leave",
        onClick: onOpenLeave,
        variant: "secondary",
      },
      primaryAction: {
        label: isUpdatingReady ? "Updating..." : currentUserReady ? "Undo Ready" : "Ready Up",
        onClick: onToggleReady,
        disabled: readyDisabled,
        variant: "secondary",
      },
      secondaryAction: isBattleCreator
        ? currentUserReady
          ? {
              label: isStartingBattle ? "Starting..." : "Start battle",
              onClick: onOpenStart,
              disabled: startDisabled,
              variant: "default",
            }
          : canCreatorCancelBattle
            ? {
                label: isCancelingBattle ? "Canceling..." : "Cancel battle",
                onClick: onOpenCancel,
                disabled: isCancelingBattle,
                variant: "destructive",
              }
            : undefined
        : undefined,
    });

    return () => {
      setBattleMobileBottomBar(null);
    };
  }, [
    canCreatorCancelBattle,
    currentUserReady,
    isBattleCreator,
    isCancelingBattle,
    isMobile,
    isStartingBattle,
    isUpdatingReady,
    onOpenCancel,
    onOpenLeave,
    onOpenStart,
    onToggleReady,
    readyDisabled,
    setBattleMobileBottomBar,
    startDisabled,
  ]);
}

