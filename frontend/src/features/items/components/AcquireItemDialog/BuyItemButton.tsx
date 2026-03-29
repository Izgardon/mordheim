import React from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@components/button";
import { Tooltip } from "@components/tooltip";
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
          <Button
            type="button"
            aria-label={label}
            variant="outline"
            size="icon"
            className="h-8 w-8"
          >
            <HandCoins className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
        content={label}
        {...rest}
      />
    );
  }
);

export default BuyItemButton;
export { getAcquireLabel };
