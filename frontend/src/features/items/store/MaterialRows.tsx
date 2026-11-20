import { useState } from "react";

import type { WeaponMaterial } from "../types/item-types";
import MaterialRow from "./MaterialRow";
import { materialWeapons } from "./material-rows";
import type { StoreOffer } from "./StoreRow";
import type { BasketLine, Recipient } from "./useStoreBasket";

type MaterialRowsProps = {
  /** The materials whose rows the store shows now (`shownMaterials`), in the server's order. */
  materials: WeaponMaterial[];
  /** The store's offers: the melee weapons among them are what a material may be made into. */
  offers: StoreOffer[];
  canBuy: boolean;
  isMobile: boolean;
  warbandId: number;
  recipients: Recipient[];
  firstKey: string | null;
  searchers: { id: number; name: string; spent: boolean }[];
  rareBonus: (item: StoreOffer["item"]) => number;
  onPick: (line: Omit<BasketLine, "id">) => void;
};

/** The store's rows for the weapon materials (weapon materials), one open at a time. */
export default function MaterialRows({ materials, offers, ...props }: MaterialRowsProps) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {materials.map((material) => (
        <MaterialRow
          key={material.slug}
          material={material}
          weapons={materialWeapons(material, offers)}
          open={open === material.slug}
          onOpen={(next) => setOpen(next ? material.slug : null)}
          {...props}
        />
      ))}
    </>
  );
}
