import type { BattleCustomUnit, BattleParticipant } from "@/features/battles/types/battle-types";

import type {
  ParticipantRoster,
  PrebattleUnit,
  UnitDetailEntry,
  UnitItemEntry,
  UnitSingleUseItem,
  UnitSpellDetailEntry,
  UnitStats,
} from "./prebattle-types";

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
  return [...roster.heroes, ...roster.hiredSwords, ...henchmenMembers];
}

export function extractUnitItems(rawItems: unknown): UnitItemEntry[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const counts = new Map<string, UnitItemEntry>();
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }
    const itemId = Number((rawItem as { id?: unknown }).id);
    const itemName = String((rawItem as { name?: unknown }).name ?? "").trim();
    const singleUse = Boolean((rawItem as { single_use?: unknown }).single_use);
    if (!Number.isFinite(itemId) || itemId <= 0 || !itemName) {
      continue;
    }
    const key = `${itemId}:${itemName}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      existing.singleUse = existing.singleUse || singleUse;
      continue;
    }
    counts.set(key, {
      id: itemId,
      name: itemName,
      count: 1,
      singleUse,
    });
  }

  return Array.from(counts.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function extractSingleUseItems(rawItems: unknown): UnitSingleUseItem[] {
  const items = extractUnitItems(rawItems);
  return items
    .filter((item) => item.singleUse)
    .map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.count,
    }));
}

export function extractDetailEntries(rawEntries: unknown): UnitDetailEntry[] {
  if (!Array.isArray(rawEntries)) {
    return [];
  }
  const entries: UnitDetailEntry[] = [];
  for (const rawEntry of rawEntries) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }
    const id = Number((rawEntry as { id?: unknown }).id);
    const name = String((rawEntry as { name?: unknown }).name ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !name) {
      continue;
    }
    entries.push({ id, name });
  }
  return entries;
}

export function extractSpellEntries(rawEntries: unknown): UnitSpellDetailEntry[] {
  if (!Array.isArray(rawEntries)) {
    return [];
  }
  const entries: UnitSpellDetailEntry[] = [];
  for (const rawEntry of rawEntries) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }
    const id = Number((rawEntry as { id?: unknown }).id);
    const name = String((rawEntry as { name?: unknown }).name ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !name) {
      continue;
    }
    entries.push({
      id,
      name,
      dc:
        (rawEntry as { dc?: unknown }).dc === undefined
          ? null
          : ((rawEntry as { dc?: string | number | null }).dc ?? null),
    });
  }
  return entries;
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
      typeof (entry as { key?: unknown }).key === "string" ? (entry as { key: string }).key.trim() : "";
    const name =
      typeof (entry as { name?: unknown }).name === "string"
        ? (entry as { name: string }).name.trim()
        : "";
    const unitType =
      typeof (entry as { unit_type?: unknown }).unit_type === "string"
        ? (entry as { unit_type: string }).unit_type.trim()
        : "";
    const isBestiary = key.startsWith("bestiary:");
    if (!key.startsWith("custom:") && !isBestiary || !name || !unitType) {
      continue;
    }
    const reason =
      typeof (entry as { reason?: unknown }).reason === "string"
        ? ((entry as { reason?: string }).reason ?? "")
        : "";
    const statsSource =
      (entry as { stats?: unknown }).stats && typeof (entry as { stats?: unknown }).stats === "object"
        ? ((entry as { stats: Record<string, unknown> }).stats as Record<string, unknown>)
        : {};
    normalized.push({
      key,
      id: key,
      kind: isBestiary ? "bestiary" : "custom",
      displayName: name,
      unitType,
      rating: toUnitRating((entry as { rating?: unknown }).rating),
      customReason: reason.trim(),
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
      reason: (unit.customReason ?? "").trim(),
      rating: toUnitRating(unit.rating),
      stats: {
        movement: unit.stats.movement,
        weapon_skill: unit.stats.weapon_skill,
        ballistic_skill: unit.stats.ballistic_skill,
        strength: unit.stats.strength,
        toughness: unit.stats.toughness,
        wounds: unit.stats.wounds,
        initiative: unit.stats.initiative,
        attacks: unit.stats.attacks,
        leadership: unit.stats.leadership,
        armour_save: unit.stats.armour_save,
      },
    }));
}

export function participantStatusLabel(status: BattleParticipant["status"]) {
  switch (status) {
    case "ready":
      return "Ready";
    case "accepted":
      return "Accepted";
    case "joined_prebattle":
      return "In Prebattle";
    case "canceled_prebattle":
      return "Canceled";
    case "invited":
      return "Invited";
    case "in_battle":
      return "In Battle";
    case "finished_battle":
      return "Finished";
    case "confirmed_postbattle":
      return "Confirmed";
    default:
      return status;
  }
}
