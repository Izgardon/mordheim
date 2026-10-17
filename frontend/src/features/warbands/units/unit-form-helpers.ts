import { statFieldMap, statFields } from "../utils/warband-utils";

import type { HeroCaster } from "../types/warband-types";

type StatSource = { [K in (typeof statFieldMap)[keyof typeof statFieldMap]]?: number | null };

/** A stored armour save as the form shows it: "5+", "0+", "-1+", or "" for none (decision 11). */
export const armourSaveToForm = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : `${value}+`;

/**
 * A typed armour save (decision 11): "5", "5+", " 5 + ", "0+" and "-1+" read as 5, 0 and -1,
 * blank as null (no save). Anything else, or outside -5..6, is undefined.
 */
export const parseArmourSave = (value: string): number | null | undefined => {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return null;
  const match = /^(-?\d)\+?$/.exec(compact);
  if (!match) return undefined;
  const save = Number(match[1]);
  return save >= -5 && save <= 6 ? save : undefined;
};

/** What a write sends: the save as a number, null for none, or the text as typed when it isn't a
 * save, so the server's message lands on the card (UX-05). */
export const buildArmourSavePayload = (value: string): number | string | null => {
  const save = parseArmourSave(value);
  return save === undefined ? value.trim() : save;
};

/** The unit's pending level-ups for its edit form (decision 5). */
export const mapLevelUpToForm = (unit: { level_up?: number | null }) => ({
  level_up: String(unit.level_up ?? 0),
  savedLevelUp: unit.level_up ?? 0,
});

/**
 * The pending level-ups a Save sends (decision 5). A queued recruit sends 0, so its typed
 * starting XP mints none (BUG-65). A saved unit sends its count only when it was edited: the
 * server then sets it as sent, while a changed XP alone still earns new ones.
 */
export const buildLevelUpPayload = (
  form: { level_up?: string; savedLevelUp?: number },
  isSessionCreated: boolean
): { level_up?: number } => {
  if (isSessionCreated) {
    return { level_up: 0 };
  }
  const typed = Math.trunc(Number(form.level_up?.trim() || 0));
  const count = Number.isFinite(typed) && typed > 0 ? typed : 0;
  return form.savedLevelUp !== undefined && count !== form.savedLevelUp ? { level_up: count } : {};
};

/** The unit's stat profile as the form's strings ("" for a missing stat). */
export const mapStatsToForm = (unit: StatSource): Record<string, string> =>
  statFields.reduce((acc, key) => {
    const value = unit[statFieldMap[key]];
    return {
      ...acc,
      [key]: value !== null && value !== undefined ? String(value) : "",
    };
  }, {});

/** The form's stat strings as payload numbers; blank and non-numeric stats are left out. */
export const buildStatPayload = (form: { stats: Record<string, string> }) =>
  statFields.reduce(
    (acc, key) => {
      const value = form.stats[key];
      if (String(value).trim()) {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          return { ...acc, [statFieldMap[key]]: parsed };
        }
      }
      return acc;
    },
    {} as Record<string, number>
  );

export const normalizeCaster = (value: HeroCaster | boolean | null | undefined): HeroCaster => {
  if (value === true) {
    return "Wizard";
  }
  if (!value) {
    return "No";
  }
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "wizard") {
      return "Wizard";
    }
    if (lower === "priest") {
      return "Priest";
    }
  }
  return "No";
};

export type UnitValidationField = "name" | "unit_type" | "race_id" | "henchmen_names";

export type UnitValidationError<F extends UnitValidationField = UnitValidationField> = {
  fields: F[];
  message: string;
};

const fieldLabels: Record<UnitValidationField, string> = {
  name: "Name",
  unit_type: "Type",
  race_id: "Race",
  henchmen_names: "Henchmen names",
};

/** "Missing: Name, Type, Race" for the identity fields every kind requires. */
export function missingIdentityFields(form: {
  name: string;
  unit_type: string;
  race_id: number | null;
}): UnitValidationField[] {
  const missing: UnitValidationField[] = [];
  if (!form.name || !form.name.trim()) {
    missing.push("name");
  }
  if (!form.unit_type || !form.unit_type.trim()) {
    missing.push("unit_type");
  }
  if (!form.race_id) {
    missing.push("race_id");
  }
  return missing;
}

export function toValidationError<F extends UnitValidationField>(
  missing: F[]
): UnitValidationError<F> | null {
  if (missing.length === 0) {
    return null;
  }
  return {
    fields: missing,
    message: `Missing: ${missing.map((field) => fieldLabels[field]).join(", ")}`,
  };
}

export const toItemEntries = (items: { id: number; cost?: number | null }[]) =>
  items.map((item) => ({ id: item.id, cost: item.cost ?? null }));
