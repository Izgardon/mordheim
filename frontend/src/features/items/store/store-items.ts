import type { Item } from "../types/item-types";

/** The store's category chips (design E), in order; "all" shows everything. */
export const STORE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "melee", label: "Melee" },
  { id: "missile", label: "Missile" },
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
