import { statFieldMap, statFields } from "../utils/warband-utils";

import type { HeroCaster } from "../types/warband-types";

type StatSource = { [K in (typeof statFieldMap)[keyof typeof statFieldMap]]?: number | null };

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
