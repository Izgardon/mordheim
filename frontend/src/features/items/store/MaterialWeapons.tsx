import { useState } from "react";
import { Search } from "lucide-react";

import { Chip } from "@/components/ui/chip";

import type { WeaponMaterial } from "../types/item-types";
import { searchWeapons, type MaterialWeapon } from "./material-rows";
import { itemName } from "./store-items";

type MaterialWeaponsProps = {
  material: WeaponMaterial;
  /** Every melee weapon the store offers, priced through the material. */
  weapons: MaterialWeapon[];
  onPick: (weapon: MaterialWeapon) => void;
};

/**
 * Which weapon is made of the material (weapon materials): every melee weapon the store offers,
 * searchable, each with what it comes to through the material ("you may choose which type of
 * hand-to-hand weapon is offered to you"), or only the weapons its own rule allows (the Dark Elf
 * Blade's swords and daggers), with that rule's sentence above them.
 */
export default function MaterialWeapons({ material, weapons, onPick }: MaterialWeaponsProps) {
  const [query, setQuery] = useState("");
  const found = searchWeapons(weapons, query);
  return (
    <div className="flex flex-col gap-2.5 border border-accent-line bg-surface p-3.5">
      <label className="flex min-h-11 items-center gap-2 border border-strong bg-page px-3 text-muted-foreground">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          type="search"
          placeholder={`Which weapon is ${material.name.toLowerCase()}?`}
          aria-label={`Search the weapons that may be made ${material.name.toLowerCase()}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
        />
      </label>
      {material.only ? <p className="m-0 text-xs text-text2">{material.only.text}</p> : null}
      {found.length === 0 ? (
        <p className="m-0 text-sm text-text2">No melee weapon by that name.</p>
      ) : (
        <div role="group" aria-label="Weapon" className="flex flex-wrap gap-1.5">
          {found.map((weapon) => (
            <Chip key={weapon.offer.item.id} onClick={() => onPick(weapon)}>
              {itemName(weapon.offer.item)}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {weapon.price == null ? material.price_note : `${weapon.price} gc`}
              </span>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
