import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { WeaponMaterial } from "../types/item-types";
import { materialPrice } from "../utils/item-prices";
import { inStoreOrder, searchWords, storeCategory, type StoreCategory } from "./store-items";
import type { HisMaterialLine } from "./his-list";
import type { StoreOffer } from "./StoreRow";

/*
 * The store's material rows (weapon materials, William 20 Nov 2026: "i should search gromril
 * weapon then under that i choose a melee only weapon to make gromril"). A material is a row of
 * its own, "Gromril Weapon", under Melee; opening it picks the weapon, and the rest of the form is
 * the normal one. An item is never transformed, and buying a weapon never asks what it is made of.
 */

/**
 * A weapon a material may be made into: its offer and its price through the material (null: not
 * known until its dice are rolled).
 */
export type MaterialWeapon = { offer: StoreOffer; price: number | null };

/**
 * A material's row: the material as the server offers it, the name it reads as, how it prices (its
 * own shape, or his list's terms where his list sells it) and the weapons it may be made into.
 */
export type MaterialRowView = {
  material: WeaponMaterial;
  name: string;
  priceNote: string;
  weapons: MaterialWeapon[];
};

export type MaterialFilters = { query: string; category: StoreCategory; onlyMine: boolean };

/** Whether the filters let a material's row show: under Melee (and All), found by its name or "weapon". */
function shown(material: WeaponMaterial, name: string, filters: MaterialFilters): boolean {
  if (filters.category !== "all" && filters.category !== "melee") return false;
  if (!material.can_take && filters.onlyMine) return false;
  return matchesSearchQuery(filters.query, name, material.name, "weapon");
}

/** His list's part: the material lines his lists sell, and the melee weapons those lists sell. */
export type HisWeapons = { lines: HisMaterialLine[]; melee: StoreOffer[] };

/**
 * The material rows the store shows now, in the server's order. What I can buy hides one the
 * warband isn't usually allowed, as it hides an item.
 *
 * On His list (`his`) the materials his lists sell show, as his list names them, each offering the
 * other melee weapons on that same list at the line's own price for them (the server's), never
 * every melee weapon in play; and after them the materials open to anyone (gromril and ithilmar,
 * which William's rule lets any unit use), offering his lists' melee weapons at their own price.
 */
export function materialRows(
  materials: WeaponMaterial[],
  offers: StoreOffer[],
  filters: MaterialFilters,
  his: HisWeapons | null = null
): MaterialRowView[] {
  if (his === null) {
    return materials.flatMap((material) => {
      const name = material.row_name;
      return shown(material, name, filters)
        ? [
            {
              material,
              name,
              priceNote: material.price_note,
              weapons: meleeWeapons(material, offers),
            },
          ]
        : [];
    });
  }
  const byId = new Map(offers.map((offer) => [offer.item.id, offer]));
  const sold = his.lines.flatMap((line) => {
    const material = materials.find((row) => row.slug === line.slug);
    if (!material || !shown(material, line.name, filters)) return [];
    const weapons = line.choices.flatMap(({ itemId, price }) => {
      const offer = byId.get(itemId);
      return offer && allowed(material, itemId) ? [{ offer, price }] : [];
    });
    return [{ material, name: line.name, priceNote: line.priceNote, weapons }];
  });
  const named = new Set(sold.map((row) => row.material.slug));
  const open = materials.flatMap((material) => {
    const name = material.row_name;
    if (named.has(material.slug) || !material.for_everyone || !shown(material, name, filters)) {
      return [];
    }
    return [
      {
        material,
        name,
        priceNote: material.price_note,
        weapons: meleeWeapons(material, his.melee),
      },
    ];
  });
  return [...sold, ...open];
}

/**
 * Every melee weapon the store offers this warband, each priced through the material (the server's
 * price for the row it is offered at; null for a price that isn't known until its dice are rolled),
 * in the store's own order.
 */
function meleeWeapons(material: WeaponMaterial, offers: StoreOffer[]): MaterialWeapon[] {
  const melee = offers.filter((offer) => storeCategory(offer.item) === "melee");
  return inStoreOrder(
    melee.map((offer) => ({ offer, view: null })),
    ""
  )
    .filter(({ offer }) => allowed(material, offer.item.id))
    .map(({ offer }) => ({
      offer,
      price:
        offer.availability.cost == null
          ? null
          : materialPrice(offer.item, offer.availability, material),
    }));
}

/**
 * Whether the material's own rule allows this weapon: the Dark Elf Blade's swords and daggers only
 * (William, 20 Nov 2026: "the one just for swords and daggers should only allow those 2"), so its
 * picker offers nothing else. The server says which items those are.
 */
const allowed = (material: WeaponMaterial, itemId: number) =>
  !material.only || material.only.item_ids.includes(itemId);

/** The weapons whose name, kind, rules or tags answer what was typed in the picker. */
export const searchWeapons = (weapons: MaterialWeapon[], query: string) =>
  weapons.filter((weapon) => matchesSearchQuery(query, ...searchWords(weapon.offer.item)));
