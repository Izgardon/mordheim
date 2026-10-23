import type { Item } from "../types/item-types";

/** The item type every bestiary beast is bought, moved and traded as. */
export const ANIMAL = "Animal";

/**
 * Whether the shop sells an item: every item but a beast whose "Available in the shop" is off
 * (`listed: false`). An unsold beast's item still exists for kits, trades and owned copies; the
 * shop and Acquire leave it out.
 */
export const isSold = (item: Pick<Item, "listed">) => item.listed !== false;

/** An Animal item's beast, whose bestiary entry writes it (the items routes refuse to). */
export const beastOf = (item: Pick<Item, "type" | "bestiary_entry">) =>
  item.type === ANIMAL ? (item.bestiary_entry ?? null) : null;

/**
 * Where an Animal item is edited: its beast's bestiary entry, with its form open (the location
 * state the Bestiary reads once).
 */
export const beastEditLink = (campaignId: number, beastId: number) => ({
  to: `/campaigns/${campaignId}/bestiary?entry=${beastId}`,
  state: { editEntry: beastId },
});
