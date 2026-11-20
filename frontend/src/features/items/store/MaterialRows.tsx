import { useState } from "react";

import MaterialRow from "./MaterialRow";
import type { MaterialRowView } from "./material-rows";
import type { StoreOffer } from "./StoreRow";
import type { BasketLine, Recipient } from "./useStoreBasket";

type MaterialRowsProps = {
  /** The material rows the store shows now (`materialRows`), in the server's order. */
  rows: MaterialRowView[];
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
export default function MaterialRows({ rows, ...props }: MaterialRowsProps) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {rows.map(({ material, name, priceNote, off, weapons }) => (
        <MaterialRow
          key={material.slug}
          material={material}
          name={name}
          priceNote={priceNote}
          off={off}
          weapons={weapons}
          open={open === material.slug}
          onOpen={(next) => setOpen(next ? material.slug : null)}
          {...props}
        />
      ))}
    </>
  );
}
