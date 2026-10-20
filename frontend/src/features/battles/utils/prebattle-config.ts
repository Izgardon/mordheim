import {
  toUnitInformationMap,
  unitInformationMapToNotes,
  unitInformationMapToOverrides,
  updateUnitInformationNotes,
  updateUnitInformationOverride,
} from "@/features/battles/components/active/active-utils";
import type {
  ParticipantRoster,
  PrebattleUnit,
  StatKey,
  UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  flattenRosterUnits,
  normalizeCustomUnits,
  serializeCustomUnits,
  toArmourSaveStat,
  toNumericStat,
  toUnitRating,
} from "@/features/battles/components/prebattle/prebattle-utils";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

type StoredUnitInformation = BattleParticipant["unit_information_json"] | undefined;

/** Prebattle's form: what Ready Up saves as the participant's config. */
export type PrebattleConfigForm = {
  allUnits: PrebattleUnit[];
  customUnits: PrebattleUnit[];
  selectedKeys: string[];
  overrides: Record<string, UnitOverride>;
  notes: Record<string, string>;
  /** undefined when the participant payload omits declared_rating; kept so the key stays absent */
  declaredRating: number | null | undefined;
  battleNotes: string;
};

/** The whole unit information map the form describes, keeping what is stored for its units. */
function buildUnitInformationPayload(stored: StoredUnitInformation, form: PrebattleConfigForm) {
  const availableUnitKeys = new Set(form.allUnits.map((unit) => unit.key));
  let next = Object.fromEntries(
    Object.entries(toUnitInformationMap(stored)).filter(([unitKey]) =>
      availableUnitKeys.has(unitKey)
    )
  );
  for (const unit of form.allUnits) {
    next = updateUnitInformationOverride(next, unit, form.overrides[unit.key]);
    next = updateUnitInformationNotes(next, unit.key, form.notes[unit.key] ?? "");
  }
  return next;
}

/** The `config/` body for the form (prebattle sends its whole form as the legacy map). */
export function buildConfigPayload(stored: StoredUnitInformation, form: PrebattleConfigForm) {
  return {
    selected_unit_keys_json: form.selectedKeys,
    unit_information_json: buildUnitInformationPayload(stored, form),
    custom_units_json: serializeCustomUnits(form.customUnits),
    declared_rating: form.declaredRating,
    battle_notes: form.battleNotes,
  };
}

/**
 * The form as the server last saved it. With no saved selection every unit starts selected; the
 * saved hash is the server's, so the first Ready Up saves that selection.
 */
export function initialPrebattleConfig(participant: BattleParticipant, roster: ParticipantRoster) {
  const customUnits = normalizeCustomUnits(participant.custom_units_json);
  const unitInformation = toUnitInformationMap(participant.unit_information_json);
  const overrides = unitInformationMapToOverrides(unitInformation);
  const notes = unitInformationMapToNotes(unitInformation);
  const allUnits = [...flattenRosterUnits(roster), ...customUnits];
  const availableKeys = allUnits.map((unit) => unit.key);
  const savedKeys = (participant.selected_unit_keys_json || []).filter((key) =>
    availableKeys.includes(key)
  );
  const savedHash = JSON.stringify(
    buildConfigPayload(participant.unit_information_json, {
      allUnits,
      customUnits,
      selectedKeys: savedKeys,
      overrides,
      notes,
      declaredRating: participant.declared_rating,
      battleNotes: participant.battle_notes ?? "",
    })
  );
  return {
    customUnits,
    selectedKeys: savedKeys.length ? savedKeys : availableKeys,
    overrides,
    notes,
    savedHash,
  };
}

export function withoutKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

/** The overrides with one of the unit's stats typed in; its own value (or empty) drops the stat. */
export function withOverrideStat(
  overrides: Record<string, UnitOverride>,
  unit: PrebattleUnit,
  key: StatKey,
  value: string
): Record<string, UnitOverride> {
  const current = overrides[unit.key] ?? { stats: {} };
  const nextStats = { ...current.stats };

  if (key === "armour_save") {
    const parsedArmourSave = value.trim() === "" ? null : toArmourSaveStat(value);
    if (parsedArmourSave === unit.stats.armour_save) {
      delete nextStats.armour_save;
    } else {
      nextStats.armour_save = parsedArmourSave;
    }
  } else {
    const parsedNumeric = value.trim() === "" ? null : toNumericStat(Number(value));
    if (parsedNumeric === null || parsedNumeric === unit.stats[key]) {
      delete nextStats[key];
    } else {
      nextStats[key] = parsedNumeric;
    }
  }

  if (Object.keys(nextStats).length === 0) {
    return withoutKey(overrides, unit.key);
  }
  return { ...overrides, [unit.key]: { ...current, stats: nextStats } };
}

/** The notes with one unit's changed; empty notes drop the unit. */
export function withUnitNotes(notes: Record<string, string>, unitKey: string, value: string) {
  return value ? { ...notes, [unitKey]: value } : withoutKey(notes, unitKey);
}

/** A rating typed in: a whole number from 0 to 9999, or null when empty or not a number. */
export function parseDeclaredRating(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.min(9999, Math.round(parsed)));
}

/** Each participant's rating as the status shows it: declared plus their temporary units. */
export function statusRatings(
  participants: BattleParticipant[],
  currentUserId: number | undefined,
  ownCustomUnits: PrebattleUnit[]
) {
  const ratings: Record<number, number | null> = {};
  for (const participant of participants) {
    const customUnitSource =
      participant.user.id === currentUserId
        ? ownCustomUnits
        : normalizeCustomUnits(participant.custom_units_json);
    const customRatingTotal = customUnitSource.reduce(
      (sum, unit) => sum + toUnitRating(unit.rating),
      0
    );
    const baseRating = participant.declared_rating;
    ratings[participant.user.id] =
      baseRating === null && customRatingTotal === 0 ? null : (baseRating ?? 0) + customRatingTotal;
  }
  return ratings;
}
