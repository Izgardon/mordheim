import type { BattleParticipant, BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type {
  ParticipantRoster,
  PrebattleUnit,
  UnitOverride,
  UnitStats,
  StatKey,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  normalizeCustomUnits,
  toArmourSaveStat,
  toNumericStat,
} from "@/features/battles/components/prebattle/prebattle-utils";
import { STAT_FIELDS } from "@/features/battles/components/prebattle/prebattle-types";

export type ActiveSectionUnits = {
  heroes: PrebattleUnit[];
  henchmen: PrebattleUnit[];
  hiredSwords: PrebattleUnit[];
  temporary: PrebattleUnit[];
};

export type ActiveBattleUnitOption = {
  unitKey: string;
  displayName: string;
  label: string;
  unitType: string;
  warbandName: string;
  participantUserId: number;
  sectionLabel: string;
};

function createSelectedKeySet(participant: BattleParticipant) {
  const keys = new Set((participant.selected_unit_keys_json ?? []).filter(Boolean));
  return keys;
}

export function getParticipantSelectedUnits(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined
): ActiveSectionUnits {
  const selectedKeys = createSelectedKeySet(participant);
  const customUnits = normalizeCustomUnits(participant.custom_units_json);

  const pickUnit = (unit: PrebattleUnit) => selectedKeys.has(unit.key);

  return {
    heroes: (roster?.heroes ?? []).filter(pickUnit),
    henchmen: (roster?.henchmenGroups ?? []).flatMap((group) => group.members).filter(pickUnit),
    hiredSwords: (roster?.hiredSwords ?? []).filter(pickUnit),
    temporary: customUnits.filter(pickUnit),
  };
}

export function buildBattleUnitOptions(
  participants: BattleParticipant[],
  rosters: Record<number, ParticipantRoster | undefined>
) {
  const options: ActiveBattleUnitOption[] = [];
  const sectionOrder = ["Heroes", "Henchmen", "Hired Swords", "Temporary Units"];
  for (const participant of participants) {
    const selectedUnits = getParticipantSelectedUnits(participant, rosters[participant.user.id]);
    const units = [
      ...selectedUnits.heroes.map((unit) => ({ unit, sectionLabel: "Heroes" })),
      ...selectedUnits.henchmen.map((unit) => ({ unit, sectionLabel: "Henchmen" })),
      ...selectedUnits.hiredSwords.map((unit) => ({ unit, sectionLabel: "Hired Swords" })),
      ...selectedUnits.temporary.map((unit) => ({ unit, sectionLabel: "Temporary Units" })),
    ];

    for (const { unit, sectionLabel } of units) {
      options.push({
        unitKey: unit.key,
        displayName: unit.displayName,
        label: `${unit.displayName} (${participant.warband.name})`,
        unitType: unit.unitType,
        warbandName: participant.warband.name,
        participantUserId: participant.user.id,
        sectionLabel,
      });
    }
  }
  return options.sort((left, right) => {
    const leftIndex = sectionOrder.indexOf(left.sectionLabel);
    const rightIndex = sectionOrder.indexOf(right.sectionLabel);
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.label.localeCompare(right.label);
  });
}

export function toUnitInformationMap(raw: unknown): Record<string, BattleUnitInformationEntry> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const normalized: Record<string, BattleUnitInformationEntry> = {};
  for (const [unitKey, unitInfo] of Object.entries(source)) {
    if (!unitInfo || typeof unitInfo !== "object") {
      continue;
    }
    const value = unitInfo as Record<string, unknown>;
    const statsOverride =
      value.stats_override && typeof value.stats_override === "object"
        ? (value.stats_override as BattleUnitInformationEntry["stats_override"])
        : {};
    const outOfAction = Boolean(value.out_of_action);
    const currentWounds = Number.isFinite(Number(value.current_wounds))
      ? Math.max(0, Math.trunc(Number(value.current_wounds)))
      : null;
    const killCount = Number.isFinite(Number(value.kill_count))
      ? Math.max(0, Math.trunc(Number(value.kill_count)))
      : 0;
    const notes = typeof value.notes === "string" ? value.notes : "";
    normalized[unitKey] = {
      stats_override: statsOverride,
      notes,
      current_wounds: currentWounds,
      out_of_action: outOfAction,
      kill_count: killCount,
    };
  }
  return normalized;
}

function hasUnitInformationContent(entry: BattleUnitInformationEntry | undefined) {
  if (!entry) {
    return false;
  }
  return Boolean(
    entry.out_of_action ||
      entry.kill_count > 0 ||
      (entry.current_wounds !== null && entry.current_wounds !== undefined) ||
      Object.keys(entry.stats_override ?? {}).length > 0 ||
      (entry.notes ?? "").trim()
  );
}

export function unitInformationToOverride(
  unitInformation: BattleUnitInformationEntry | undefined
): UnitOverride | undefined {
  if (!unitInformation) {
    return undefined;
  }
  const stats = unitInformation.stats_override ?? {};
  if (!Object.keys(stats).length) {
    return undefined;
  }
  return {
    stats,
  };
}

export function getEffectiveUnitStats(
  unit: PrebattleUnit,
  unitInformation: BattleUnitInformationEntry | undefined
): UnitStats {
  return {
    ...unit.stats,
    ...(unitInformation?.stats_override ?? {}),
  };
}

export function getCurrentUnitWounds(
  unit: PrebattleUnit,
  unitInformation: BattleUnitInformationEntry | undefined
) {
  return toNumericStat(
    unitInformation?.current_wounds ??
      unitInformation?.stats_override?.wounds ??
      unit.stats.wounds ??
      0
  );
}

export function normalizeUnitOverride(unit: PrebattleUnit, override: UnitOverride | undefined) {
  if (!override) {
    return undefined;
  }

  const cleanedStats: Partial<UnitStats> = {};
  for (const field of STAT_FIELDS) {
    const rawValue = override.stats[field.key];
    if (rawValue === undefined) {
      continue;
    }

    if (field.key === "armour_save") {
      const parsed = toArmourSaveStat(rawValue);
      if (parsed !== unit.stats.armour_save) {
        cleanedStats.armour_save = parsed;
      }
      continue;
    }

    const parsed = toNumericStat(rawValue);
    if (parsed !== unit.stats[field.key]) {
      cleanedStats[field.key] = parsed;
    }
  }

  if (!Object.keys(cleanedStats).length) {
    return undefined;
  }

  return {
    stats: cleanedStats,
  };
}

export function updateUnitInformationOverride(
  unitInformationByKey: Record<string, BattleUnitInformationEntry>,
  unit: PrebattleUnit,
  override: UnitOverride | undefined
) {
  const next = { ...unitInformationByKey };
  const existing = next[unit.key];
  const normalizedOverride = normalizeUnitOverride(unit, override);

  if (!normalizedOverride) {
    if (!existing) {
      return next;
    }
    if (hasUnitInformationContent(existing)) {
      next[unit.key] = {
        ...existing,
        stats_override: {},
      };
      return next;
    }
    delete next[unit.key];
    return next;
  }

  next[unit.key] = {
    stats_override: normalizedOverride.stats,
    notes: existing?.notes ?? "",
    current_wounds: existing?.current_wounds ?? null,
    out_of_action: existing?.out_of_action ?? false,
    kill_count: existing?.kill_count ?? 0,
  };
  return next;
}

export function setUnitOverrideStat(
  unitInformationByKey: Record<string, BattleUnitInformationEntry>,
  unit: PrebattleUnit,
  statKey: StatKey,
  value: number | null
) {
  const existingOverride = unitInformationToOverride(unitInformationByKey[unit.key]) ?? {
    stats: {},
  };
  const nextStats = { ...existingOverride.stats };

  if (statKey === "armour_save") {
    if (value === null) {
      delete nextStats.armour_save;
    } else {
      nextStats.armour_save = value;
    }
  } else if (value === unit.stats[statKey]) {
    delete nextStats[statKey];
  } else {
    nextStats[statKey] = value;
  }

  return updateUnitInformationOverride(unitInformationByKey, unit, { stats: nextStats });
}

export function setUnitCurrentWounds(
  unitInformationByKey: Record<string, BattleUnitInformationEntry>,
  unit: PrebattleUnit,
  wounds: number
) {
  const next = { ...unitInformationByKey };
  const existing = next[unit.key];
  const normalizedWounds = Math.max(0, Math.min(10, Math.trunc(wounds)));
  const defaultWounds = toNumericStat(existing?.stats_override?.wounds ?? unit.stats.wounds ?? 0);

  if (
    normalizedWounds === defaultWounds &&
    !hasUnitInformationContent(existing)
  ) {
    delete next[unit.key];
    return next;
  }

  next[unit.key] = {
    stats_override: existing?.stats_override ?? {},
    notes: existing?.notes ?? "",
    current_wounds: normalizedWounds === defaultWounds ? null : normalizedWounds,
    out_of_action: existing?.out_of_action ?? false,
    kill_count: existing?.kill_count ?? 0,
  };

  if (!hasUnitInformationContent(next[unit.key])) {
    delete next[unit.key];
  }

  return next;
}

export function updateUnitInformationNotes(
  unitInformationByKey: Record<string, BattleUnitInformationEntry>,
  unitKey: string,
  notes: string
) {
  const next = { ...unitInformationByKey };
  const existing = next[unitKey];
  const normalizedNotes = notes.trim();

  if (!existing && !normalizedNotes) {
    return next;
  }

  if (!existing) {
    next[unitKey] = {
      stats_override: {},
      notes: normalizedNotes,
      current_wounds: null,
      out_of_action: false,
      kill_count: 0,
    };
    return next;
  }

  next[unitKey] = {
    ...existing,
    notes: normalizedNotes,
  };

  if (!hasUnitInformationContent(next[unitKey])) {
    delete next[unitKey];
  }

  return next;
}

export function unitInformationMapToOverrides(
  unitInformationByKey: Record<string, BattleUnitInformationEntry>
) {
  const overrides: Record<string, UnitOverride> = {};
  for (const [unitKey, unitInformation] of Object.entries(unitInformationByKey)) {
    const override = unitInformationToOverride(unitInformation);
    if (!override) {
      continue;
    }
    overrides[unitKey] = override;
  }
  return overrides;
}

export function unitInformationMapToNotes(
  unitInformationByKey: Record<string, BattleUnitInformationEntry>
) {
  const notesByUnitKey: Record<string, string> = {};
  for (const [unitKey, unitInformation] of Object.entries(unitInformationByKey)) {
    const notes = unitInformation.notes?.trim() ?? "";
    if (!notes) {
      continue;
    }
    notesByUnitKey[unitKey] = notes;
  }
  return notesByUnitKey;
}
