import type { ItemKind } from "@/components/ui/game-icons";

import type { Item } from "./types/item-types";

/** What an item is, for its icon and its subtitle: the one mapping from its type and subtype. */
export function itemKind(item: Pick<Item, "type" | "subtype" | "beast_kind">): ItemKind {
  const type = (item.type ?? "").toLowerCase();
  const subtype = (item.subtype ?? "").toLowerCase();
  if (type === "weapon") {
    if (subtype.includes("blackpowder")) return "blackpowder";
    if (subtype.includes("ranged") || subtype.includes("missile")) return "missile";
    return "melee";
  }
  if (type === "armour") return subtype === "shield" ? "shield" : "armour";
  if (type === "animal" || item.beast_kind) return "animal";
  if (/poison|drug|consumable|ammunition/.test(subtype)) return "consumable";
  if (subtype.includes("trade")) return "trade";
  return "misc";
}

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  melee: "Melee weapon",
  missile: "Ranged weapon",
  blackpowder: "Blackpowder",
  armour: "Armour",
  shield: "Shield",
  animal: "Animal",
  consumable: "Consumable",
  trade: "Trade good",
  misc: "Miscellaneous",
};

/** The kind line under an item's name: its subtype where it says more ("Ridden Animals"). */
export function itemKindLine(item: Pick<Item, "type" | "subtype" | "beast_kind">) {
  const kind = itemKind(item);
  const subtype = item.subtype?.trim();
  if (kind === "misc" || kind === "animal") return subtype || ITEM_KIND_LABEL[kind];
  return ITEM_KIND_LABEL[kind];
}

/** An item box's second line: its kind and its stats ("Melee weapon · S As user · Close Combat"). */
export const itemStatsLine = (
  item: Pick<Item, "type" | "subtype" | "beast_kind" | "strength" | "range" | "save">
) =>
  [
    itemKindLine(item),
    item.strength && `S ${item.strength}`,
    item.range,
    item.save && `Save ${item.save}`,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * An item box's subtitle on a unit's card: its subtype ("Melee", "Shield", "Pet"), else its type,
 * never its stats (William, 22 Nov 2026: the boxes "just need to show their Subtype").
 */
export const itemSubtype = (item: Pick<Item, "type" | "subtype">) =>
  item.subtype?.trim() || item.type?.trim() || "";
