import type { ReactNode } from "react";

import { PriceRarity, ReferenceRow, type ColumnSort } from "@/features/reference/ReferenceList";

import { itemFigures, itemStatsLine, itemSubtype } from "../item-kind";
import { itemName } from "../store/store-items";
import { isCommon, priceLabel, rarityLabel } from "../utils/item-prices";
import type { WargearRowData } from "./wargear-rows";

/** The web's columns, Price and Rarity sorting the list as the phone's sort button does. */
export const wargearColumns = (sort: { price: ColumnSort; rarity: ColumnSort }) => [
  { label: "Type", className: "w-[150px] shrink-0" },
  { label: "Price", className: "w-[124px] shrink-0", sort: sort.price },
  { label: "Rarity", className: "w-[96px] shrink-0", sort: sort.rarity },
  { label: "Rules", className: "w-[240px] shrink-0 max-[1180px]:hidden" },
  { label: "Setting", className: "w-[120px] shrink-0 max-[1320px]:hidden" },
];

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
  const { item, availability, warning, settingName } = row;
  const key = String(item.id);
  const price = priceLabel(availability);
  const rarity = availability ? rarityLabel(availability.rarity) : "-";
  const rare = Boolean(availability && !isCommon(availability.rarity));
  const stat = itemFigures(item);
  return (
    <ReferenceRow
      id={key}
      open={open}
      onToggle={onToggle}
      name={itemName(item)}
      sub={isMobile ? itemStatsLine(item) : undefined}
      warn={warning}
      dim={Boolean(warning)}
      aside={<PriceRarity price={price} rarity={rarity} rare={rare} />}
      cells={
        isMobile
          ? undefined
          : [
              <>
                <span>{itemSubtype(item)}</span>
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
              <span key="setting">{settingName}</span>,
            ]
      }
    >
      {children}
    </ReferenceRow>
  );
}
