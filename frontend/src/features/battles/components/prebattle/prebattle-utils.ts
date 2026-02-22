import type { BattleCustomUnit, BattleParticipant } from "@/features/battles/types/battle-types";

import type {
  NumericStatKey,
  ParticipantRoster,
  PrebattleUnit,
  UnitSingleUseItem,
  UnitOverride,
  UnitStats,
} from "./prebattle-types";
import { STAT_FIELDS } from "./prebattle-types";

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

export function toArmourSave(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().slice(0, 20);
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
    armour_save: toArmourSave(source.armour_save),
  };
}

export function flattenRosterUnits(roster: ParticipantRoster | undefined): PrebattleUnit[] {
  if (!roster) {
    return [];
  }
  const henchmenMembers = roster.henchmenGroups.flatMap((group) => group.members);
  return [...roster.heroes, ...roster.hiredSwords, ...henchmenMembers];
}

export function extractSingleUseItems(rawItems: unknown): UnitSingleUseItem[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const counts = new Map<string, UnitSingleUseItem>();
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }
    const itemId = Number((rawItem as { id?: unknown }).id);
    const itemName = String((rawItem as { name?: unknown }).name ?? "").trim();
    const singleUse = Boolean((rawItem as { single_use?: unknown }).single_use);
    if (!Number.isFinite(itemId) || itemId <= 0 || !itemName || !singleUse) {
      continue;
    }
    const itemDescription = String((rawItem as { description?: unknown }).description ?? "").trim();
    const key = `${itemId}:${itemName}`;
    const existing = counts.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    counts.set(key, {
      id: itemId,
      name: itemName,
      quantity: 1,
      description: itemDescription || undefined,
    });
  }

  return Array.from(counts.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function normalizeOverrides(raw: unknown): Record<string, UnitOverride> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const normalized: Record<string, UnitOverride> = {};
  for (const [unitKey, override] of Object.entries(raw as Record<string, unknown>)) {
    if (!override || typeof override !== "object") {
      continue;
    }
    const reason =
      typeof (override as { reason?: unknown }).reason === "string"
        ? ((override as { reason?: string }).reason ?? "")
        : "";
    const statsRaw = (override as { stats?: unknown }).stats;
    const cleanedStats: Partial<UnitStats> = {};
    if (statsRaw && typeof statsRaw === "object") {
      for (const [key, value] of Object.entries(statsRaw as Record<string, unknown>)) {
        if (STAT_FIELDS.some((field) => field.key === key)) {
          if (key === "armour_save") {
            cleanedStats.armour_save = toArmourSave(value);
          } else {
            cleanedStats[key as NumericStatKey] = toNumericStat(value);
          }
        }
      }
    }

    if (Object.keys(cleanedStats).length || reason.trim()) {
      normalized[unitKey] = { reason, stats: cleanedStats };
    }
  }
  return normalized;
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
    if (!key.startsWith("custom:") || !name || !unitType) {
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
      kind: "custom",
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
    .filter((unit) => unit.kind === "custom")
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
