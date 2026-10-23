import type { Item, ItemProperty, Restriction } from "../types/item-types";

/**
 * The types the items form writes. Animal items come from the bestiary (one per beast, written by
 * its form), so the items form never offers them.
 */
export const ITEM_TYPE_OPTIONS = ["Weapon", "Armour", "Miscellaneous"];

/** Each type's subtypes (the Wargear filter's too): an Animal item's is its beast's kind. */
export const ITEM_SUBTYPE_OPTIONS: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Armour: ["Armour", "Shield", "Helmet", "Barding"],
  Animal: ["Mount", "Pet", "Creature"],
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
  return {
    name: values.name.trim(),
    type: values.type.trim(),
    subtype: hasSubtype(values.type) ? values.subtype.trim() : "",
    single_use: values.type === "Miscellaneous" ? values.singleUse : false,
    description: values.description.trim(),
    strength: values.strength.trim() || null,
    range: values.range.trim() || null,
    save: values.save.trim() || null,
    // Only Animal items carried a statblock; their beasts' profiles replaced it.
    statblock: null,
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

const badPrice = (row: AvailabilityRow) => !row.cost.trim() || !(Number(row.cost) >= 0);

const badRarity = (row: AvailabilityRow) => {
  const rarity = Number(row.rarity);
  return !row.rarity.trim() || Number.isNaN(rarity) || rarity < 2 || rarity > 20;
};

export const PRICE_HINT = "Needs a price of 0 or more.";
export const RARITY_HINT = "Needs a rarity from 2 to 20.";
export const NO_AVAILABILITY_HINT = "Add at least one availability.";

/**
 * What stops a save before it is sent, the server's own limits (a price of 0 or more, a rarity
 * from 2 to 20), each under its own Price or Rarity (or the availabilities list), as the server's
 * refusals are; a missing name or type is the line under the form.
 */
export function itemFormProblems(values: ItemFormValues): {
  line: string | null;
  fields: Record<string, string>;
} {
  if (!values.name.trim() || !values.type.trim()) {
    return { line: "Name and type are required.", fields: {} };
  }
  const rows = values.availabilities;
  if (rows.length === 0) {
    return { line: null, fields: { availabilities: NO_AVAILABILITY_HINT } };
  }
  const fields: Record<string, string> = {};
  rows.forEach((row, index) => {
    if (badPrice(row)) fields[`availabilities.${index}.cost`] = PRICE_HINT;
    if (badRarity(row)) fields[`availabilities.${index}.rarity`] = RARITY_HINT;
  });
  return { line: null, fields };
}
