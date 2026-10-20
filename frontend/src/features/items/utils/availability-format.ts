import type { ItemAvailability } from "../types/item-types";

/** The Wargear table's Rarity cell: "Common" for 2, the number otherwise. */
export const formatRarity = (value?: number | null) => {
  if (value === 2) {
    return "Common";
  }
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value);
};

export const formatCost = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value);
};

/** The Restricted to cell: each restriction with its note, or "-" when anyone may buy it. */
export const formatRestrictions = (avail: ItemAvailability | null): string => {
  if (!avail?.restrictions?.length) return "-";
  return avail.restrictions
    .map((link) => {
      const name = link.restriction.restriction;
      return link.additional_note ? `${name} (${link.additional_note})` : name;
    })
    .join(", ");
};

/**
 * One availability in a line, for the row under an item's name on a phone, where the Restricted
 * to and Rarity columns are hidden (CAT-UX-03): "Forest Goblins · Common", "Lizardmen, Skaven ·
 * Rare 7", or just "Common" when anyone may buy it.
 */
export const formatAvailabilitySummary = (avail: ItemAvailability | null): string => {
  if (!avail) return "";
  const rarity = avail.rarity === 2 ? "Common" : `Rare ${avail.rarity}`;
  return avail.restrictions?.length ? `${formatRestrictions(avail)} · ${rarity}` : rarity;
};
