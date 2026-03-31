import type { BattleParticipant, BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type {
  ParticipantRoster,
  PrebattleUnit,
  UnitOverride,
  UnitStats,
  StatKey,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  flattenRosterUnits,
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
  for (const participant of participants) {
    const selectedKeys = createSelectedKeySet(participant);
    const rosterUnits = flattenRosterUnits(rosters[participant.user.id]);
    const customUnits = normalizeCustomUnits(participant.custom_units_json);
    const units = [...rosterUnits, ...customUnits];
    for (const unit of units) {
      if (!selectedKeys.has(unit.key)) {
        continue;
      }
      options.push({
        unitKey: unit.key,
        displayName: unit.displayName,
        label: `${unit.displayName} (${participant.warband.name})`,
        unitType: unit.unitType,
        warbandName: participant.warband.name,
        participantUserId: participant.user.id,
      });
    }
  }
  return options.sort((left, right) => left.label.localeCompare(right.label));
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
    const statsReason =
      typeof value.stats_reason === "string" ? value.stats_reason : "";
    const outOfAction = Boolean(value.out_of_action);
    const currentWounds = Number.isFinite(Number(value.current_wounds))
      ? Math.max(0, Math.trunc(Number(value.current_wounds)))
      : null;
    const killCount = Number.isFinite(Number(value.kill_count))
      ? Math.max(0, Math.trunc(Number(value.kill_count)))
      : 0;
    normalized[unitKey] = {
      stats_override: statsOverride,
      stats_reason: statsReason,
      current_wounds: currentWounds,
      out_of_action: outOfAction,
      kill_count: killCount,
    };
  }
  return normalized;
}

export function unitInformationToOverride(
  unitInformation: BattleUnitInformationEntry | undefined
): UnitOverride | undefined {
  if (!unitInformation) {
    return undefined;
  }
  const stats = unitInformation.stats_override ?? {};
  const reason = unitInformation.stats_reason ?? "";
  if (!Object.keys(stats).length && !reason.trim()) {
    return undefined;
  }
  return {
    reason,
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

  const reason = override.reason.trim();
  if (!Object.keys(cleanedStats).length && !reason) {
    return undefined;
  }

  return {
    reason,
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
    if (
      existing.out_of_action ||
      existing.kill_count > 0 ||
      existing.current_wounds !== null && existing.current_wounds !== undefined
    ) {
      next[unit.key] = {
        ...existing,
        stats_override: {},
        stats_reason: "",
      };
      return next;
    }
    delete next[unit.key];
    return next;
  }

  next[unit.key] = {
    stats_override: normalizedOverride.stats,
    stats_reason: normalizedOverride.reason,
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
    reason: "",
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

  return updateUnitInformationOverride(unitInformationByKey, unit, {
    reason: existingOverride.reason,
    stats: nextStats,
  });
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
    !existing?.out_of_action &&
    (existing?.kill_count ?? 0) <= 0 &&
    !Object.keys(existing?.stats_override ?? {}).length &&
    !(existing?.stats_reason ?? "").trim()
  ) {
    delete next[unit.key];
    return next;
  }

  next[unit.key] = {
    stats_override: existing?.stats_override ?? {},
    stats_reason: existing?.stats_reason ?? "",
    current_wounds: normalizedWounds === defaultWounds ? null : normalizedWounds,
    out_of_action: existing?.out_of_action ?? false,
    kill_count: existing?.kill_count ?? 0,
  };

  if (
    next[unit.key].current_wounds === null &&
    !next[unit.key].out_of_action &&
    next[unit.key].kill_count <= 0 &&
    !Object.keys(next[unit.key].stats_override).length &&
    !next[unit.key].stats_reason.trim()
  ) {
    delete next[unit.key];
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
