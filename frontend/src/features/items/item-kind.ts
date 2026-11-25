import type { ItemKind } from "@/components/ui/game-icons";

import type { Item } from "./types/item-types";

type KindFields = Pick<Item, "type" | "subtype" | "beast_kind">;

const lower = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

/** An Animal item's kind: its beast's, else read from its subtype ("Ridden Animals" is a mount). */
function animalKind(item: KindFields): ItemKind {
  if (item.beast_kind) return item.beast_kind;
  const subtype = lower(item.subtype);
  if (subtype.includes("pet")) return "pet";
  if (/mount|ridden/.test(subtype)) return "mount";
  return "creature";
}

/** What an item is, for its icon and its subtitle: the one mapping from its type and subtype. */
export function itemKind(item: KindFields): ItemKind {
  const type = lower(item.type);
  const subtype = lower(item.subtype);
  if (type === "weapon") {
    if (subtype.includes("blackpowder")) return "blackpowder";
    if (/ranged|missile|thrown/.test(subtype)) return "missile";
    return "melee";
  }
  if (type === "armour") {
    if (subtype === "shield") return "shield";
    if (subtype === "helmet") return "helmet";
    return "armour";
  }
  if (type === "animal" || item.beast_kind) return animalKind(item);
  if (/poison|drug|consumable|ammunition/.test(subtype)) return "consumable";
  if (subtype.includes("trade")) return "trade";
  return "misc";
}

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  melee: "Melee",
  missile: "Ranged",
  blackpowder: "Blackpowder",
  armour: "Armour",
  shield: "Shield",
  helmet: "Helmet",
  mount: "Mount",
  creature: "Creature",
  pet: "Pet",
  consumable: "Consumable",
  trade: "Trade good",
  misc: "Miscellaneous",
};

const ANIMALS = new Set<ItemKind>(["mount", "creature", "pet"]);
/** The kinds whose label is the whole story: a weapon's way of fighting, an animal's kind. */
const LABELLED = new Set<ItemKind>(["melee", "missile", "blackpowder", ...ANIMALS]);

/**
 * What an item is, in a word (William, 25 Nov 2026: "Items should show their subtype"): a weapon's
 * Melee, Ranged or Blackpowder, an animal's Mount, Creature or Pet, body armour's Armour, and any
 * other its own subtype ("Shield", "Poisons and Drugs"), else its kind's.
 */
export function itemSubtype(item: KindFields) {
  const kind = itemKind(item);
  if (LABELLED.has(kind)) return ITEM_KIND_LABEL[kind];
  const subtype = item.subtype?.trim() ?? "";
  if (!subtype || (kind === "armour" && /^(body )?armou?r$/i.test(subtype))) {
    return ITEM_KIND_LABEL[kind];
  }
  return subtype;
}

type StatFields = KindFields & Pick<Item, "strength" | "range" | "save" | "save_bonus">;

/** "Save 5+" as printed, else the steps it adds ("Save +2"); an animal's are its profile's. */
function saveText(item: StatFields) {
  const save = item.save?.trim() ?? "";
  if (/^[+-]?\d\+?$/.test(save)) return `Save ${save}`;
  if (item.save_bonus && !ANIMALS.has(itemKind(item))) return `Save +${item.save_bonus}`;
  return save ? `Save ${save}` : null;
}

/** An item's figures: its range where it isn't close combat, its strength and its save. */
export function itemFigures(item: StatFields) {
  const range = item.range?.trim();
  const strength = item.strength?.trim();
  return [
    range && !/close/i.test(range) ? range : null,
    strength ? `Str ${strength}` : null,
    saveText(item),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * An item's subtitle wherever its stats show: its subtype, then its figures ("Melee · Str As
 * user", "Ranged · 24\" · Str 3", "Armour · Save 5+").
 */
export const itemStatsLine = (item: StatFields) =>
  [itemSubtype(item), itemFigures(item)].filter(Boolean).join(" · ");
