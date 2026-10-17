import { useCallback, useEffect, useState } from "react";

import {
  buildHenchmenOptions,
  buildLevelUpPayload,
  parseRollTotal,
  resolveHenchmen2d6Stat,
} from "../../utils/levelup-utils";
import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { useUnitAdvance } from "./useUnitMutations";
import { promoteHenchman } from "./promote-henchman";

import type { LevelUpCore, UnitAdvance } from "./level-up-types";

const GROUPS = { key: "henchmen_group", listKey: "henchmenGroups" } as const;

/**
 * Henchmen advances: 2d6 only (WS BS S I A Ld), and Lad's Got Talent on 10-12, which promotes
 * one member to a hero through today's client chain (BUG-28, pinned) and asks for a re-roll.
 */
export function useLadsGotTalentAdvance({
  unit: group,
  warbandId,
  open,
  onOpenChange,
  onLevelUpLogged,
  onGroupRemoved,
  hasRolled2d6,
  roll2d6Total,
  setRoll2d6Total,
  selectedStat,
  setSelectedStat,
  setLevelUpError,
  setIsSubmitting,
}: LevelUpCore<"henchmen_group">): UnitAdvance {
  const [ladsGotTalent, setLadsGotTalent] = useState(false);
  const [selectedHenchmanId, setSelectedHenchmanId] = useState("");
  const updateWarbandCache = useWarbandCacheUpdate();
  const { mutateAsync: logAdvance } = useUnitAdvance(GROUPS, warbandId);
  const isLadsGotTalentRoll = roll2d6Total !== null && roll2d6Total >= 10;
  const shouldPromptReroll = ladsGotTalent && isLadsGotTalentRoll;
  const henchmenOptions = buildHenchmenOptions(group);

  // Auto-select the first henchman when Lad's Got Talent is ticked.
  useEffect(() => {
    if (!open) return;
    if (ladsGotTalent && !selectedHenchmanId && henchmenOptions.length > 0) {
      setSelectedHenchmanId(henchmenOptions[0].id);
    }
  }, [henchmenOptions, ladsGotTalent, open, selectedHenchmanId]);

  useEffect(() => {
    setLadsGotTalent(false);
    setSelectedHenchmanId("");
  }, [open]);

  const handleSelectStat = useCallback(
    (statId: string) => {
      setSelectedStat((current) => (current === statId ? null : statId));
      setLevelUpError("");
    },
    [setLevelUpError, setSelectedStat]
  );

  const setChecked = useCallback(
    (checked: boolean) => {
      setLadsGotTalent(checked);
      if (checked && henchmenOptions.length > 0 && !selectedHenchmanId) {
        setSelectedHenchmanId(henchmenOptions[0].id);
      }
    },
    [henchmenOptions, selectedHenchmanId]
  );

  const handleRoll2d6Complete = useCallback(
    (results: unknown) => {
      const total = parseRollTotal(results);
      setRoll2d6Total(total);
      if (total === null) return;
      const { stat, ladsGotTalent: isLadsGotTalent } = resolveHenchmen2d6Stat(total);
      if (isLadsGotTalent) {
        setSelectedStat(null);
        setLadsGotTalent(true);
      } else if (stat) {
        setSelectedStat(stat);
      }
    },
    [setRoll2d6Total, setSelectedStat]
  );

  const handleLevelUpConfirm = useCallback(async () => {
    if (!selectedStat) {
      setLevelUpError("A Level up must be chosen.");
      return;
    }
    if (ladsGotTalent && isLadsGotTalentRoll) {
      setLevelUpError("Lads Got Talent rolled - roll again for a stat increase.");
      return;
    }
    if (ladsGotTalent && !selectedHenchmanId) {
      setLevelUpError("Select a henchman to promote.");
      return;
    }

    setIsSubmitting(true);
    setLevelUpError("");
    try {
      if (ladsGotTalent) {
        const outcome = await promoteHenchman({
          warbandId,
          group,
          selectedHenchmanId,
          henchmenOptions,
          selectedStat,
          roll2d6Total,
          onLevelUpLogged,
          onGroupRemoved,
          updateWarbandCache,
        });
        if (outcome === "not-found") {
          setLevelUpError("Unable to locate the selected henchman.");
          return;
        }
      } else {
        const groupName = group.name?.trim() || group.unit_type?.trim() || "Henchmen Group";
        const updatedGroup = await logAdvance({
          unitId: group.id,
          payload: buildLevelUpPayload({
            nameKey: "group",
            unitName: groupName,
            selectedStat,
            roll2d6Total,
          }),
        });
        if (updatedGroup) {
          onLevelUpLogged?.(updatedGroup);
        }
      }
      onOpenChange(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setLevelUpError(errorResponse.message || "Unable to log level up");
      } else {
        setLevelUpError("Unable to log level up");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedStat,
    ladsGotTalent,
    isLadsGotTalentRoll,
    selectedHenchmanId,
    group,
    warbandId,
    logAdvance,
    roll2d6Total,
    henchmenOptions,
    onLevelUpLogged,
    onGroupRemoved,
    onOpenChange,
    setIsSubmitting,
    setLevelUpError,
    updateWarbandCache,
  ]);

  return {
    handleSelectStat,
    handleRoll2d6Complete,
    handleLevelUpConfirm,
    isConfirmBlocked: !selectedStat || shouldPromptReroll,
    ladsGotTalent: {
      roll2d6Total,
      hasRolled2d6,
      checked: ladsGotTalent,
      setChecked,
      shouldPromptReroll,
      selectedHenchmanId,
      setSelectedHenchmanId,
      options: henchmenOptions,
    },
  };
}
