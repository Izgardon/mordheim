import type { BattleParticipant, BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type { ParticipantRoster, PrebattleUnit, UnitOverride } from "@/features/battles/components/prebattle/prebattle-types";
import { flattenRosterUnits, normalizeCustomUnits } from "@/features/battles/components/prebattle/prebattle-utils";

export type ActiveSectionUnits = {
  heroes: PrebattleUnit[];
  henchmen: PrebattleUnit[];
  hiredSwords: PrebattleUnit[];
  temporary: PrebattleUnit[];
};

export type ActiveBattleUnitOption = {
  unitKey: string;
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
    const killCount = Number.isFinite(Number(value.kill_count))
      ? Math.max(0, Math.trunc(Number(value.kill_count)))
      : 0;
    normalized[unitKey] = {
      stats_override: statsOverride,
      stats_reason: statsReason,
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
