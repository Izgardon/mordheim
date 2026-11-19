import type { Item } from "../types/item-types";

/** The store's category chips (design E), in order; "all" shows everything. */
export const STORE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "melee", label: "Melee" },
  { id: "missile", label: "Ranged" },
  { id: "armour", label: "Armour" },
  { id: "misc", label: "Misc" },
  { id: "animals", label: "Animals" },
] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number]["id"];

const MISSILE = new Set(["ranged", "missile", "blackpowder", "thrown"]);

/** Which chip an item sits under: its type, and for a weapon whether it is shot or swung. */
export function storeCategory(item: Pick<Item, "type" | "subtype">): Exclude<StoreCategory, "all"> {
  const type = (item.type ?? "").toLowerCase();
  if (type === "animal") return "animals";
  if (type === "armour") return "armour";
  if (type === "weapon")
    return MISSILE.has((item.subtype ?? "").toLowerCase()) ? "missile" : "melee";
  return "misc";
}

/** The line under an item's name: its subtype, else its type ("Blackpowder", "Armour"). */
export const kindOf = (item: Pick<Item, "type" | "subtype">) => item.subtype || item.type;

/** An item's name with its variant in brackets: "Lamp of the Djinn (Mutiny in Marienburg)". */
export const itemName = (item: Pick<Item, "name" | "variant">) =>
  item.variant ? `${item.name} (${item.variant})` : item.name;

/** The words an item is found by: its name, kind, rules' names and its tags ("scimitar"). */
export const searchWords = (item: Item) => [
  item.name,
  item.variant ?? "",
  item.subtype ?? "",
  item.type,
  ...(item.rules ?? []).map((rule) => rule.name),
  ...(item.tags ?? []),
];

/**
 * How well an item's own name answers the search: exact, then starts with it, then holds it, then
 * 3 for a row found only by its kind, a rule's name or a tag. 0 for every row when nothing is
 * typed, so the order falls through to rarity.
 */
export function searchRank(query: string, name: string): number {
  const term = query.trim().toLowerCase();
  if (!term) return 0;
  const lower = name.toLowerCase();
  if (lower === term) return 0;
  if (lower.startsWith(term)) return 1;
  if (lower.includes(term)) return 2;
  return 3;
}

/** The lowest rarity the warband is offered the item at; Common (null) counts as 0. */
const rarityOf = (rows: { rarity: number | null }[]) =>
  Math.min(...rows.map((row) => row.rarity ?? 0));

type StoreSortable = {
  offer: { item: Item; rows: { rarity: number | null }[] };
  /** His list, which renames the item: ranked and sorted by the name the row shows. */
  view?: { name: string } | null;
};

/**
 * The store's order (William, 18 Nov 2026: "by rarity, but string matching still matters most"):
 * the closest name match first, then the easiest to find, then by name. With nothing typed every
 * row ranks the same, so the common kit sits at the top.
 */
export function inStoreOrder<T extends StoreSortable>(rows: T[], query: string): T[] {
  const shown = (row: T) => row.view?.name ?? row.offer.item.name;
  return [...rows].sort((a, b) => {
    const rank = searchRank(query, shown(a)) - searchRank(query, shown(b));
    if (rank !== 0) return rank;
    const rarity = rarityOf(a.offer.rows) - rarityOf(b.offer.rows);
    if (rarity !== 0) return rarity;
    return shown(a).localeCompare(shown(b));
  });
}

/** A weapon: the only kind of item a material goes on (weapon materials). */
export const isWeapon = (item: Pick<Item, "type">) => (item.type ?? "").toLowerCase() === "weapon";
