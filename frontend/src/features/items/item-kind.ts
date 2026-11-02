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
  if (type === "armour") return "armour";
  if (type === "animal" || item.beast_kind) return "animal";
  if (/poison|drug|consumable|ammunition/.test(subtype)) return "consumable";
  if (subtype.includes("trade")) return "trade";
  return "misc";
}

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  melee: "Melee weapon",
  missile: "Missile weapon",
  blackpowder: "Blackpowder",
  armour: "Armour",
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
