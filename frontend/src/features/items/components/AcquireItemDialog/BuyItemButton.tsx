import React from "react";
import { Tooltip } from "@components/tooltip";
import buyIcon from "@/assets/components/buy.webp";
import type { Item } from "../../types/item-types";

type BuyItemButtonProps = {
  item: Item;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "children" | "content">;

function getAcquireLabel(item: Item) {
  if (item.type === "Weapon") {
    return `Acquire ${item.subtype?.toLowerCase() || ""} weapon`.replace("  ", " ");
  }
  if (item.type === "Animal" && item.subtype === "Attack") {
    return "Acquire attack animal";
  }
  return `Acquire ${item.subtype?.toLowerCase() || "item"}`;
}

const BuyItemButton = React.forwardRef<HTMLSpanElement, BuyItemButtonProps>(
  function BuyItemButton({ item, ...rest }, ref) {
    const label = getAcquireLabel(item);

    return (
      <Tooltip
        ref={ref}
        trigger={
          <button
            type="button"
            aria-label={label}
            className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
          >
            <img src={buyIcon} alt="" className="h-full w-full object-contain" />
          </button>
        }
        content={label}
        {...rest}
      />
    );
  }
);

export default BuyItemButton;
export { getAcquireLabel };
