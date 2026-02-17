import { useCallback, useEffect, useState } from "react";

import { useAppStore } from "@/stores/app-store";
import {
  createWarbandHero,
  deleteWarbandHenchmenGroup,
  getWarbandHenchmenGroupDetail,
  levelUpWarbandHenchmenGroup,
  levelUpWarbandHero,
  updateWarbandHenchmenGroup,
} from "../../api/warbands-api";
import { emitWarbandUpdate } from "../../api/warbands-events";
import {
  buildHenchmenOptions,
  buildLevelUpPayload,
  HENCHMEN_SELECTABLE_STAT_SET,
  isHenchmenSelectableStat,
  parseRollTotal,
  resolveAdvanceLabel,
  resolveCasterValue,
  resolveHenchmanFromGroup,
  resolveHenchmen2d6Stat,
  resolveLargeValue,
  splitGroupItems,
} from "../../utils/levelup-utils";

import type { UnitStats } from "../../components/shared/unit_details/UnitStatsTable";
import type { HenchmenGroup } from "../../types/warband-types";

const groupToUnitStats = (group: HenchmenGroup): UnitStats => ({
  movement: group.movement,
  weapon_skill: group.weapon_skill,
  ballistic_skill: group.ballistic_skill,
  strength: group.strength,
  toughness: group.toughness,
  wounds: group.wounds,
  initiative: group.initiative,
  attacks: group.attacks,
  leadership: group.leadership,
  armour_save: group.armour_save,
});

const groupRaceToUnitStats = (group: HenchmenGroup): UnitStats | null => {
  if (!group.race) return null;
  return {
    movement: group.race.movement,
    weapon_skill: group.race.weapon_skill,
    ballistic_skill: group.race.ballistic_skill,
    strength: group.race.strength,
    toughness: group.race.toughness,
    wounds: group.race.wounds,
    initiative: group.race.initiative,
    attacks: group.race.attacks,
    leadership: group.race.leadership,
  };
};

type UseHenchmenLevelUpOptions = {
  group: HenchmenGroup;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLevelUpLogged?: (updatedGroup: HenchmenGroup) => void;
  onGroupRemoved?: (groupId: number) => void;
};

export default function useHenchmenLevelUp({
  group,
  warbandId,
  open,
  onOpenChange,
  onLevelUpLogged,
  onGroupRemoved,
}: UseHenchmenLevelUpOptions) {
  const [rollSignal2d6, setRollSignal2d6] = useState(0);
  const [hasRolled2d6, setHasRolled2d6] = useState(false);
  const [roll2d6Total, setRoll2d6Total] = useState<number | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [ladsGotTalent, setLadsGotTalent] = useState(false);
  const [selectedHenchmanId, setSelectedHenchmanId] = useState("");
  const [levelUpError, setLevelUpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupDetail, setGroupDetail] = useState<HenchmenGroup | null>(null);
  const [groupDetailLoading, setGroupDetailLoading] = useState(false);
  const { diceColor } = useAppStore();

  const groupWithRace = groupDetail ?? group;
  const groupStats = groupToUnitStats(groupWithRace);
  const raceStats = groupRaceToUnitStats(groupWithRace);
  const statDelta = isHenchmenSelectableStat(selectedStat)
    ? ({ [selectedStat]: 1 } as Partial<Record<string, number>>)
    : undefined;

  const isLadsGotTalentRoll = roll2d6Total !== null && roll2d6Total >= 10;
  const shouldPromptReroll = ladsGotTalent && isLadsGotTalentRoll;
  const henchmenOptions = buildHenchmenOptions(groupWithRace);

  // Auto-select first henchman when LGT toggled on
  useEffect(() => {
    if (!open) return;
    if (ladsGotTalent && !selectedHenchmanId && henchmenOptions.length > 0) {
      setSelectedHenchmanId(henchmenOptions[0].id);
    }
  }, [henchmenOptions, ladsGotTalent, open, selectedHenchmanId]);

  useEffect(() => {
    setGroupDetail(null);
  }, [group.id]);

  useEffect(() => {
    if (!open) return;
    if (group.race || groupDetail?.race || groupDetailLoading) return;
    setGroupDetailLoading(true);
    getWarbandHenchmenGroupDetail(warbandId, group.id)
      .then((data) => setGroupDetail(data))
      .catch(() => setGroupDetail(null))
      .finally(() => setGroupDetailLoading(false));
  }, [group.id, group.race, groupDetail?.race, groupDetailLoading, open, warbandId]);

  useEffect(() => {
    setRollSignal2d6(0);
    setSelectedStat(null);
    setHasRolled2d6(false);
    setRoll2d6Total(null);
    setLadsGotTalent(false);
    setSelectedHenchmanId("");
    setLevelUpError("");
    setIsSubmitting(false);
  }, [open]);

  const handleSelectStat = useCallback((statId: string) => {
    setSelectedStat((current) => (current === statId ? null : statId));
    setLevelUpError("");
  }, []);

  const setLadsGotTalentChecked = useCallback((checked: boolean) => {
    setLadsGotTalent(checked);
    if (checked && henchmenOptions.length > 0 && !selectedHenchmanId) {
      setSelectedHenchmanId(henchmenOptions[0].id);
    }
  }, [henchmenOptions, selectedHenchmanId]);

  const triggerRoll2d6 = useCallback(() => {
    setRollSignal2d6((prev) => prev + 1);
    setHasRolled2d6(true);
    setRoll2d6Total(null);
    setLevelUpError("");
  }, []);

  const handleRoll2d6Complete = useCallback((results: unknown) => {
    const total = parseRollTotal(results);
    setRoll2d6Total(total);
    if (total === null) return;
    const { stat, ladsGotTalent: isLGT } = resolveHenchmen2d6Stat(total);
    if (isLGT) {
      setSelectedStat(null);
      setLadsGotTalent(true);
    } else if (stat) {
      setSelectedStat(stat);
    }
  }, []);

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

    const groupName = group.name?.trim() || group.unit_type?.trim() || "Henchmen Group";
    const advanceLabel = resolveAdvanceLabel(selectedStat);
    const roll1 = roll2d6Total !== null
      ? { dice: "2d6" as const, result: { total: roll2d6Total } }
      : undefined;

    setIsSubmitting(true);
    setLevelUpError("");
    try {
      if (ladsGotTalent) {
        const resolved = resolveHenchmanFromGroup(groupWithRace, selectedHenchmanId);
        if (!resolved) {
          setLevelUpError("Unable to locate the selected henchman.");
          return;
        }
        const { henchman, index, list } = resolved;
        const promotedName =
          henchman.name?.trim() ||
          henchmenOptions.find((option) => option.id === selectedHenchmanId)?.label ||
          `Henchman ${index + 1}`;

        const { removed, remaining } = splitGroupItems(groupWithRace.items ?? []);
        const casterValue = resolveCasterValue(groupWithRace);
        const largeValue = resolveLargeValue(groupWithRace);

        const createdHero = await createWarbandHero(
          warbandId,
          {
            name: promotedName || null,
            unit_type: groupWithRace.unit_type ?? null,
            race: groupWithRace.race_id ?? null,
            price: 0,
            xp: groupWithRace.xp ?? 0,
            level_up: 2,
            deeds: groupWithRace.deeds ?? null,
            armour_save: groupWithRace.armour_save ?? null,
            large: largeValue,
            caster: casterValue,
            half_rate: groupWithRace.half_rate ?? null,
            movement: groupWithRace.movement ?? null,
            weapon_skill: groupWithRace.weapon_skill ?? null,
            ballistic_skill: groupWithRace.ballistic_skill ?? null,
            strength: groupWithRace.strength ?? null,
            toughness: groupWithRace.toughness ?? null,
            wounds: groupWithRace.wounds ?? null,
            initiative: groupWithRace.initiative ?? null,
            attacks: groupWithRace.attacks ?? null,
            leadership: groupWithRace.leadership ?? null,
            item_ids: removed.map((item) => item.id),
            skill_ids: groupWithRace.skills?.map((skill) => skill.id) ?? [],
            special_ids: groupWithRace.specials?.map((entry) => entry.id) ?? [],
            spell_ids: [],
            ignore_max_heroes: true,
          },
          { emitUpdate: false },
        );

        const heroPayload = buildLevelUpPayload({
          unitName: createdHero.name?.trim() || createdHero.unit_type?.trim() || "Unknown Hero",
          selectedStat,
          roll2d6Total,
        });
        await levelUpWarbandHero(warbandId, createdHero.id, heroPayload);

        const nextHenchmen = list.filter((_, idx) => idx !== index);
        if (nextHenchmen.length === 0) {
          await deleteWarbandHenchmenGroup(warbandId, group.id, { emitUpdate: false });
          onGroupRemoved?.(group.id);
        } else {
          const updatedGroup = await updateWarbandHenchmenGroup(warbandId, group.id, {
            henchmen: nextHenchmen.map((entry) => ({
              id: entry.id,
              name: entry.name,
              kills: entry.kills,
              dead: entry.dead,
              cost: entry.cost,
            })),
            item_ids: remaining.map((item) => item.id),
          });
          if (updatedGroup) {
            onLevelUpLogged?.(updatedGroup);
          }
        }

        emitWarbandUpdate(warbandId);
      } else {
        const updatedGroup = await levelUpWarbandHenchmenGroup(warbandId, group.id, {
          group: groupName,
          advance: {
            id: selectedStat,
            label: advanceLabel,
          },
          ...(roll1 ? { roll1 } : {}),
          ...(ladsGotTalent
            ? {
                lads_got_talent: true,
                henchman_id: selectedHenchmanId || null,
                henchman_name:
                  henchmenOptions.find((option) => option.id === selectedHenchmanId)?.label ?? null,
              }
            : {}),
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
    selectedStat, ladsGotTalent, isLadsGotTalentRoll, selectedHenchmanId,
    group, groupWithRace, warbandId, roll2d6Total, henchmenOptions,
    onLevelUpLogged, onGroupRemoved, onOpenChange,
  ]);

  return {
    // dice state
    rollSignal2d6,
    roll2d6Total,
    hasRolled2d6,
    diceColor,

    // stat selection
    selectedStat,
    statDelta,
    groupStats,
    raceStats,
    selectableStatSet: HENCHMEN_SELECTABLE_STAT_SET,

    // LGT state
    ladsGotTalent,
    isLadsGotTalentRoll,
    shouldPromptReroll,
    selectedHenchmanId,
    setSelectedHenchmanId,
    henchmenOptions,
    setLadsGotTalentChecked,

    // form state
    levelUpError,
    isSubmitting,

    // actions
    handleSelectStat,
    triggerRoll2d6,
    handleRoll2d6Complete,
    handleLevelUpConfirm,
  };
}
