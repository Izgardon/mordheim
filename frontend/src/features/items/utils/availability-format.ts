import type { ItemAvailability } from "../types/item-types";

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
