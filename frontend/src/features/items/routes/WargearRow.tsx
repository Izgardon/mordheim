import type { ReactNode } from "react";

import { PriceRarity, ReferenceRow } from "@/features/reference/ReferenceList";

import { itemName, kindOf } from "../store/store-items";
import type { Item } from "../types/item-types";
import { isCommon, priceLabel, rarityLabel } from "../utils/item-prices";
import type { WargearRowData } from "./wargear-rows";

export const WARGEAR_COLUMNS = [
  { label: "Type", className: "w-[150px] shrink-0" },
  { label: "Price", className: "w-[124px] shrink-0" },
  { label: "Rarity", className: "w-[96px] shrink-0" },
  { label: "Rules", className: "w-[240px] shrink-0 max-[1180px]:hidden" },
];

/** "S as user +1", "30\" · S 4", "Save 6+": an item's figures in one line. */
function statOf(item: Item) {
  const parts: string[] = [];
  if (item.range && !/close/i.test(item.range)) parts.push(item.range);
  if (item.strength) parts.push(`S ${item.strength.replace(/^As user/i, "as user")}`);
  if (item.save) parts.push(`Save ${item.save}`);
  return parts.join(" · ");
}

/** One Wargear row: the item's kind and figures, the warband's price and rarity, its first rules. */
export default function WargearRow({
  row,
  isMobile,
  open,
  onToggle,
  children,
}: {
  row: WargearRowData;
  isMobile: boolean;
  open: boolean;
  onToggle: () => void;
  /** The open row's card. */
  children: ReactNode;
}) {
  const { item, availability, warning } = row;
  const key = String(item.id);
  const price = priceLabel(availability);
  const rarity = availability ? rarityLabel(availability.rarity) : "-";
  const rare = Boolean(availability && !isCommon(availability.rarity));
  const stat = statOf(item);
  return (
    <ReferenceRow
      id={key}
      open={open}
      onToggle={onToggle}
      name={itemName(item)}
      sub={isMobile ? [kindOf(item), stat].filter(Boolean).join(" · ") : undefined}
      warn={warning}
      dim={Boolean(warning)}
      aside={<PriceRarity price={price} rarity={rarity} rare={rare} />}
      cells={
        isMobile
          ? undefined
          : [
              <>
                <span>{kindOf(item)}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{stat}</span>
              </>,
              <span key="price" className="font-mono font-bold text-ink">
                {price}
              </span>,
              <span key="rarity" className={rare ? "font-semibold text-accent-text" : ""}>
                {rarity}
              </span>,
              <span key="rules" className="flex flex-row flex-wrap gap-1">
                {(item.rules ?? [])
                  .filter((rule) => rule.name)
                  .slice(0, 4)
                  .map((rule) => (
                    <span
                      key={rule.id}
                      className="border border-border px-[7px] py-0.5 text-xs font-semibold"
                    >
                      {rule.name}
                    </span>
                  ))}
              </span>,
            ]
      }
    >
      {children}
    </ReferenceRow>
  );
}
