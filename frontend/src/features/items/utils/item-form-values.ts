import {
  blankItemStatblock,
  parseItemStatblock,
  STAT_LABELS,
  type ItemStatblock,
} from "@/features/catalogue/utils/statblock";

import type { Item, ItemProperty, Restriction } from "../types/item-types";

export const ITEM_TYPE_OPTIONS = ["Weapon", "Armour", "Animal", "Miscellaneous"];

export const ITEM_SUBTYPE_OPTIONS: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Armour: ["Armour", "Shield", "Helmet", "Barding"],
  Animal: ["Mount", "Attack"],
};

/** Weapons, armour and animals have a subtype; miscellaneous items don't. */
export const hasSubtype = (type: string) =>
  type === "Weapon" || type === "Armour" || type === "Animal";

type AvailabilityRestrictionRow = {
  restrictionId: number;
  restrictionLabel: string;
  additionalNote: string;
};

/** One availability as the form edits it (the restrictions are carried over, not edited). */
export type AvailabilityRow = {
  cost: string;
  rarity: string;
  variableCost: string;
  restrictions: AvailabilityRestrictionRow[];
};

export type AvailabilityTextField = "cost" | "rarity" | "variableCost";

export type ItemFormValues = {
  name: string;
  type: string;
  subtype: string;
  singleUse: boolean;
  description: string;
  strength: string;
  range: string;
  save: string;
  statblock: ItemStatblock;
  availabilities: AvailabilityRow[];
};

export const blankAvailability = (): AvailabilityRow => ({
  cost: "",
  rarity: "",
  variableCost: "",
  restrictions: [],
});

const restrictionLabel = (restriction: Restriction) =>
  `${restriction.restriction} (${restriction.type})`;

/** An item's values for the form; a blank form for null. */
export function itemValuesOf(item: Item | null): ItemFormValues {
  return {
    name: item?.name ?? "",
    type: item?.type ?? "",
    subtype: item?.subtype ?? "",
    singleUse: item?.single_use ?? false,
    description: item?.description ?? "",
    strength: item?.strength ?? "",
    range: item?.range ?? "",
    save: item?.save ?? "",
    statblock: item ? parseItemStatblock(item.statblock) : blankItemStatblock(),
    availabilities:
      item && item.availabilities?.length > 0
        ? item.availabilities.map((availability) => ({
            cost: availability.cost?.toString() ?? "",
            rarity: availability.rarity?.toString() ?? "",
            variableCost: availability.variable_cost ?? "",
            restrictions: (availability.restrictions ?? []).map((link) => ({
              restrictionId: link.restriction.id,
              restrictionLabel: restrictionLabel(link.restriction),
              additionalNote: link.additional_note ?? "",
            })),
          }))
        : [blankAvailability()],
  };
}

/** An item's properties as chips; their descriptions fill in from the cached list. */
export const itemPropertiesOf = (item: Item | null): ItemProperty[] =>
  (item?.properties ?? []).map((property) => ({
    id: property.id,
    name: property.name,
    type: property.type,
    description: "",
  }));

/** The types the form offers: the four, and an edited item's own if it is another. */
export function itemTypeOptions(item: Item | null) {
  const current = item?.type?.trim();
  return current && !ITEM_TYPE_OPTIONS.includes(current)
    ? [current, ...ITEM_TYPE_OPTIONS]
    : ITEM_TYPE_OPTIONS;
}

/** The body an item create or edit sends (an edit sends no campaign_id). */
export function itemPayload(values: ItemFormValues, propertyIds: number[]) {
  const hasStatblockValues = STAT_LABELS.some((label) => values.statblock[label].trim());
  return {
    name: values.name.trim(),
    type: values.type.trim(),
    subtype: hasSubtype(values.type) ? values.subtype.trim() : "",
    single_use: values.type === "Miscellaneous" ? values.singleUse : false,
    description: values.description.trim(),
    strength: values.strength.trim() || null,
    range: values.range.trim() || null,
    save: values.save.trim() || null,
    statblock:
      values.type === "Animal" && hasStatblockValues ? JSON.stringify(values.statblock) : null,
    property_ids: propertyIds,
    availabilities: values.availabilities.map((row) => ({
      cost: Number(row.cost),
      rarity: Number(row.rarity),
      variable_cost: row.variableCost.trim() || null,
      restrictions: row.restrictions.map((restriction) => ({
        restriction_id: restriction.restrictionId,
        additional_note: restriction.additionalNote,
      })),
    })),
  };
}

const missingPrice = (row: AvailabilityRow) =>
  !row.cost.trim() || !row.rarity.trim() || !(Number(row.cost) >= 0);

const badRarity = (row: AvailabilityRow) => {
  const rarity = Number(row.rarity);
  return Number.isNaN(rarity) || rarity < 2 || rarity > 20;
};

/**
 * What stops a save before it is sent, the server's own limits (a price of 0 or more, a rarity
 * from 2 to 20): one line for the page's form ("summary"), or naming the row in the dialog.
 */
export function itemFormProblem(
  values: ItemFormValues,
  wording: "summary" | "per-row"
): string | null {
  if (!values.name.trim() || !values.type.trim()) {
    return "Name and type are required.";
  }
  const rows = values.availabilities;
  if (wording === "summary") {
    return rows.length === 0 || rows.some((row) => missingPrice(row) || badRarity(row))
      ? "Each availability needs a price of 0 or more and a rarity from 2 to 20."
      : null;
  }
  if (rows.length === 0) {
    return "At least one availability is required.";
  }
  for (const [index, row] of rows.entries()) {
    if (missingPrice(row)) {
      return `Availability ${index + 1}: a price of 0 or more and a rarity are required.`;
    }
    if (badRarity(row)) {
      return `Availability ${index + 1}: rarity must be between 2 and 20.`;
    }
  }
  return null;
}
