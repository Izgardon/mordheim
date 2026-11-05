import type { TemplateUpgrade } from "../../types/hire-template-types";

/*
 * Upgrades bought onto a hero from the warband's template (the templates plan, phase 3): a
 * Mutation, a Blessing of Nurgle, a Sacred marking or a Mark. The server gives each upgrade's
 * price and the price of the second and later of its group (`later_cost`, double for Mutations
 * and Blessings); these helpers pick which applies and say what warns. Nothing here blocks.
 */

/** The template's upgrades by group, in its order: [group, its upgrades]. */
export function upgradeGroups(upgrades: TemplateUpgrade[]): [string, TemplateUpgrade[]][] {
  const groups = new Map<string, TemplateUpgrade[]>();
  for (const upgrade of upgrades)
    groups.set(upgrade.group, [...(groups.get(upgrade.group) ?? []), upgrade]);
  return [...groups.entries()];
}

/**
 * A group's note, said once over its upgrades: "With the Mutant skill." for the Beastmen's and
 * the Marauders' Mutations (the notes its upgrades carry, each once; "" for none).
 */
export const groupNote = (members: Pick<TemplateUpgrade, "note">[]) =>
  [...new Set(members.map((upgrade) => upgrade.note.trim()).filter(Boolean))].join(" ");

/** What it costs a hero who already has (or has picked) `held` of its group: the first's price, else the later's. */
export const upgradePrice = (upgrade: TemplateUpgrade, held: number) =>
  held > 0 ? upgrade.later_cost : upgrade.cost;

/** "50", "free", or "price to type" when the book gives none. */
export const upgradePriceText = (price: number | null) =>
  price === null ? "price to type" : price === 0 ? "free" : `${price} gc`;

/** Past the most of its group one hero may have (a warning, never a block). */
export function overUpgradeMax(upgrade: TemplateUpgrade, count: number): string | null {
  const max = upgrade.max_per_fighter;
  return max !== null && count > max
    ? `At most ${max} from ${upgrade.group}: he would have ${count}.`
    : null;
}

/** "Bought only when recruited." for one bought later, in the store (a warning). */
export const AT_RECRUIT = "Bought only when recruited.";
