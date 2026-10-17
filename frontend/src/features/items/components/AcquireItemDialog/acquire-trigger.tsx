import type { ReactNode } from "react";

import BuyItemButton from "./BuyItemButton";

import type { Item } from "../../types/item-types";

/** The node the dialog opens from: the default Buy button, the caller's node, or none. */
export function acquireTriggerNode(item: Item, trigger: ReactNode | null | undefined) {
  if (trigger === undefined) {
    return <BuyItemButton item={item} />;
  }
  if (trigger === null) {
    return null;
  }
  return (
    <span
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          (event.currentTarget as HTMLElement).click();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {trigger}
    </span>
  );
}
