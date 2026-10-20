import type {
  BattleCustomUnit,
  BattleParticipant,
  BattleUnitInformationEntry,
  BattleUnitStats,
} from "@/features/battles/types/battle-types";

/**
 * The fields `/config/` lets a player change on one unit (BUG-44). Each named field replaces that
 * unit's value; other units and fields stay as the server has them. Kills and out of action are
 * never in it: only `unit-kill/`, `unit-ooa/` and `void/` move them.
 */
export type UnitInformationPatchEntry = {
  current_wounds?: number | null;
  notes?: string;
  stats_override?: Partial<BattleUnitStats>;
};

export type UnitInformationPatch = Record<string, UnitInformationPatchEntry>;

/** What the active page sends to `/config/`: only the fields that changed. */
export type ParticipantConfigPatch = {
  selected_unit_keys_json?: string[];
  unit_information_patch?: UnitInformationPatch;
  custom_units_json?: BattleCustomUnit[];
  battle_notes?: string;
};

const EMPTY_ENTRY: BattleUnitInformationEntry = {
  stats_override: {},
  notes: "",
  current_wounds: null,
  out_of_action: false,
  kill_count: 0,
};

/** Two saves made while one was in flight become one: per unit, the newer fields win. */
export function mergeConfigPatches(
  queued: ParticipantConfigPatch,
  next: ParticipantConfigPatch
): ParticipantConfigPatch {
  const merged: ParticipantConfigPatch = { ...queued, ...next };
  if (queued.unit_information_patch || next.unit_information_patch) {
    const units: UnitInformationPatch = { ...queued.unit_information_patch };
    for (const [unitKey, entry] of Object.entries(next.unit_information_patch ?? {})) {
      units[unitKey] = { ...units[unitKey], ...entry };
    }
    merged.unit_information_patch = units;
  }
  return merged;
}

/** The participant as the server will have it once the patch is saved (shown at once). */
export function applyConfigPatch(
  participant: BattleParticipant,
  patch: ParticipantConfigPatch
): BattleParticipant {
  const unitInformation = { ...participant.unit_information_json };
  for (const [unitKey, entry] of Object.entries(patch.unit_information_patch ?? {})) {
    unitInformation[unitKey] = { ...EMPTY_ENTRY, ...unitInformation[unitKey], ...entry };
  }
  return {
    ...participant,
    unit_information_json: unitInformation,
    ...(patch.selected_unit_keys_json
      ? { selected_unit_keys_json: patch.selected_unit_keys_json }
      : {}),
    ...(patch.custom_units_json ? { custom_units_json: patch.custom_units_json } : {}),
    ...(patch.battle_notes !== undefined ? { battle_notes: patch.battle_notes } : {}),
  };
}
