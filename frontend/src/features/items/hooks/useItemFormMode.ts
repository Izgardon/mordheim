import { useState } from "react";

import {
  holdsAdvanced,
  readItemFormMode,
  storeItemFormMode,
  type ItemFormMode,
} from "../utils/item-form-mode";
import { itemValuesOf } from "../utils/item-form-values";

import type { Item } from "../types/item-types";

/** Advanced for an item holding what only Advanced shows, else the viewer's last choice. */
const openingMode = (item: Item | null): ItemFormMode =>
  item && holdsAdvanced(itemValuesOf(item)) ? "advanced" : readItemFormMode();

/**
 * The item dialog's Simple or Advanced view, settled each time it opens (before its first paint,
 * so an item with advanced data never shows in Simple first). A choice is kept for the viewer.
 */
export function useItemFormMode(item: Item | null, open: boolean) {
  const [state, setState] = useState(() => ({ open, mode: openingMode(item) }));
  let { mode } = state;
  if (state.open !== open) {
    mode = open ? openingMode(item) : mode;
    setState({ open, mode });
  }
  return {
    mode,
    choose: (next: ItemFormMode) => {
      storeItemFormMode(next);
      setState((current) => ({ ...current, mode: next }));
    },
  };
}
