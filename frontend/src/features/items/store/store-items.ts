import type { Warband, WarbandTypeBrief } from "@/features/warbands/types/warband-types";

import type { Item, ItemAvailability, Restriction } from "../types/item-types";

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

export const isCommon = (rarity: number) => rarity <= 2;
export const rarityLabel = (rarity: number) => (isCommon(rarity) ? "Common" : `Rare ${rarity}`);

/**
 * The warband as "What I can buy" reads it (grading phase 1, a stop-gap until the items rebuild
 * puts who can buy on the server): the names of its warband type and the types it counts as, their
 * groups (races and sides), and the settings in play in its campaign.
 */
export type Buyer = { types: string[]; groups: string[]; settings: string[] };

const words = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** The buyer a warband is: its types' and groups' names, and its campaign's settings in play. */
export function buyerOf(
  warband: Pick<Warband, "warband_type" | "counts_as">,
  settings: string[]
): Buyer {
  const types = [warband.warband_type, ...(warband.counts_as ?? [])].filter(
    (type): type is WarbandTypeBrief => type !== null
  );
  return {
    types: types.map((type) => type.name),
    groups: [...new Set(types.flatMap((type) => type.groups))],
    settings,
  };
}

/** The setting a "Khemri Setting" restriction names (Nehekhara is Khemri's). */
const SETTING_NAMES: Record<string, string> = { " nehekharan ": " khemri " };
const settingOf = (text: string) => {
  const named = words(text.replace(/\bsetting\b/i, ""));
  return SETTING_NAMES[named] ?? named;
};

/** The restriction names the warband: one of its groups, one of its types, or words in a type's name. */
function names(buyer: Buyer, text: string) {
  const wanted = words(text);
  return (
    buyer.groups.some((group) => words(group) === wanted) ||
    buyer.types.some((type) => words(type).includes(wanted))
  );
}

/**
 * Whether a restriction lets this warband buy: a Warband or Warband Group one names its type or
 * one of its groups ("Skaven" for Skaven of Clan Pestilens; "Non-Skaven" for anyone else), a
 * Setting one is in play in the campaign. Anything else (artifacts) is left to the player.
 */
export function allows(restriction: Restriction, buyer: Buyer) {
  const name = restriction.restriction.trim();
  if (restriction.type === "Setting") {
    return buyer.settings.some((setting) => words(setting) === settingOf(name));
  }
  if (restriction.type === "Warband Group" && /^non-/i.test(name)) {
    return !names(buyer, name.slice(4));
  }
  if (restriction.type === "Warband" || restriction.type === "Warband Group") {
    return names(buyer, name);
  }
  return true;
}

const canUse = (availability: ItemAvailability, buyer: Buyer) =>
  !availability.restrictions?.length ||
  availability.restrictions.some((link) => allows(link.restriction, buyer));

/** "Skaven only", "Amazons (Lustria), Lizardmen only": who a restricted availability is for. */
const warningOf = (availability: ItemAvailability) =>
  `${availability.restrictions.map((link) => link.restriction.restriction).join(", ")} only`;

/**
 * The availability the store offers this warband: the commonest one it may use, else (the item is
 * restricted for it) the first one, with its warning. The player may still buy it (a guide, not a
 * gatekeeper).
 */
export function offerFor(item: Item, buyer: Buyer) {
  const usable = (item.availabilities ?? [])
    .filter((availability) => canUse(availability, buyer))
    .sort((a, b) => a.rarity - b.rarity || a.cost - b.cost);
  if (usable.length) return { availability: usable[0], warning: "" };
  const first = item.availabilities?.[0] ?? null;
  return { availability: first, warning: first ? warningOf(first) : "" };
}

/** "+D6x10 gc", "+2D6": the dice a variable price adds, and what each pip is worth. */
export function variableDice(text: string | null | undefined) {
  const match = /^\+\s*\(?\s*(\d*)\s*d6\s*(?:[x×]\s*(\d+))?/i.exec((text ?? "").trim());
  if (!match) return null;
  return { count: Number(match[1] || 1), times: Number(match[2] || 1) };
}

/** The price column: "15 gc", or "100 + 1D6×10" for a variable price. */
export function priceLabel(availability: ItemAvailability | null) {
  if (!availability) return "-";
  const dice = variableDice(availability.variable_cost);
  if (dice) {
    const times = dice.times > 1 ? `×${dice.times}` : "";
    return `${availability.cost} + ${dice.count}D6${times}`;
  }
  return availability.variable_cost
    ? `${availability.cost} gc ${availability.variable_cost}`
    : `${availability.cost} gc`;
}
