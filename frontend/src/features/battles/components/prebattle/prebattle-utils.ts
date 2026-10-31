import type { BattleCustomUnit } from "@/features/battles/types/battle-types";

import type { ParticipantRoster, PrebattleUnit, UnitStats } from "./prebattle-types";

export function toNumericStat(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(10, Math.round(value)));
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(10, Math.round(parsed)));
}

export function toArmourSaveStat(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "-") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}

export function toUnitRating(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(9999, Math.round(value)));
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(9999, Math.round(parsed)));
}

export function getUnitStats(source: Record<string, unknown>): UnitStats {
  return {
    movement: toNumericStat(source.movement),
    weapon_skill: toNumericStat(source.weapon_skill),
    ballistic_skill: toNumericStat(source.ballistic_skill),
    strength: toNumericStat(source.strength),
    toughness: toNumericStat(source.toughness),
    wounds: toNumericStat(source.wounds),
    initiative: toNumericStat(source.initiative),
    attacks: toNumericStat(source.attacks),
    leadership: toNumericStat(source.leadership),
    armour_save: toArmourSaveStat(source.armour_save),
  };
}

export function flattenRosterUnits(roster: ParticipantRoster | undefined): PrebattleUnit[] {
  if (!roster) {
    return [];
  }
  const henchmenMembers = roster.henchmenGroups.flatMap((group) => group.members);
  return [...roster.heroes, ...roster.hirelings, ...henchmenMembers, ...(roster.petModels ?? [])];
}

export function normalizeCustomUnits(raw: unknown): PrebattleUnit[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: PrebattleUnit[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const key =
      typeof (entry as { key?: unknown }).key === "string"
        ? (entry as { key: string }).key.trim()
        : "";
    const name =
      typeof (entry as { name?: unknown }).name === "string"
        ? (entry as { name: string }).name.trim()
        : "";
    const unitType =
      typeof (entry as { unit_type?: unknown }).unit_type === "string"
        ? (entry as { unit_type: string }).unit_type.trim()
        : "";
    const isBestiary = key.startsWith("bestiary:");
    if ((!key.startsWith("custom:") && !isBestiary) || !name || !unitType) {
      continue;
    }
    const statsSource =
      (entry as { stats?: unknown }).stats &&
      typeof (entry as { stats?: unknown }).stats === "object"
        ? ((entry as { stats: Record<string, unknown> }).stats as Record<string, unknown>)
        : {};
    normalized.push({
      key,
      id: key,
      kind: isBestiary ? "bestiary" : "custom",
      displayName: name,
      unitType,
      rating: toUnitRating((entry as { rating?: unknown }).rating),
      stats: getUnitStats(statsSource),
      singleUseItems: [],
    });
  }
  return normalized;
}

export function serializeCustomUnits(customUnits: PrebattleUnit[]): BattleCustomUnit[] {
  return customUnits
    .filter((unit) => unit.kind === "custom" || unit.kind === "bestiary")
    .map((unit) => ({
      key: unit.key,
      name: unit.displayName,
      unit_type: unit.unitType,
      rating: toUnitRating(unit.rating),
      // Custom-unit stats are already built with toNumericStat, so this only narrows the type.
      stats: {
        movement: toNumericStat(unit.stats.movement),
        weapon_skill: toNumericStat(unit.stats.weapon_skill),
        ballistic_skill: toNumericStat(unit.stats.ballistic_skill),
        strength: toNumericStat(unit.stats.strength),
        toughness: toNumericStat(unit.stats.toughness),
        wounds: toNumericStat(unit.stats.wounds),
        initiative: toNumericStat(unit.stats.initiative),
        attacks: toNumericStat(unit.stats.attacks),
        leadership: toNumericStat(unit.stats.leadership),
        armour_save: unit.stats.armour_save,
      },
    }));
}
