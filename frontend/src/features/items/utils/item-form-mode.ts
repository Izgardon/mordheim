import type { ItemFormValues } from "./item-form-values";

/**
 * The item form's two views (William, 7 Nov 2026: "improve new item form with simple/advanced").
 * Simple: the name, type and subtype, one price (cost, dice, rarity) and the rules. Advanced adds
 * more prices, who can buy and the note when buying, the source and link, rule notes and flavour.
 */
export type ItemFormMode = "simple" | "advanced";

export const ITEM_FORM_MODE_KEY = "mordheim_item_form_mode";
export const DEFAULT_ITEM_FORM_MODE: ItemFormMode = "simple";

/** The viewer's last choice on this device, or Simple when there is none or storage can't be read. */
export function readItemFormMode(): ItemFormMode {
  try {
    return window.localStorage.getItem(ITEM_FORM_MODE_KEY) === "advanced"
      ? "advanced"
      : DEFAULT_ITEM_FORM_MODE;
  } catch {
    return DEFAULT_ITEM_FORM_MODE;
  }
}

/** Keeps the choice for this device; storage failing only loses the memory of it. */
export function storeItemFormMode(mode: ItemFormMode) {
  try {
    window.localStorage.setItem(ITEM_FORM_MODE_KEY, mode);
  } catch {
    // Private mode or full storage: the choice holds while the page stays open.
  }
}

/**
 * Whether the values hold anything only Advanced shows: a second price, a who-can list, a note,
 * label or cost note on a price, a source or link, rule notes or flavour. Such an item opens in
 * Advanced, so nothing it holds is hidden.
 */
export function holdsAdvanced(values: ItemFormValues) {
  const { prices } = values;
  return (
    prices.length > 1 ||
    prices.some(
      (row) =>
        !row.who.forEveryone ||
        row.who.lines.length > 0 ||
        [row.note, row.label, row.costNote].some((text) => text.trim())
    ) ||
    [values.source, values.linkUrl, values.notes, values.flavour].some((text) => text.trim())
  );
}

/** The first price's figures: the only refusals Simple shows beside the form's own line. */
const SIMPLE_PRICE_FIELD = /^availabilities\.0\.(cost|dice|dice_multiplier|rarity)$/;

/** Whether a refusal sits under a field Simple hides (another price, who can buy). */
export const hidesAnError = (errors: Record<string, string | undefined>) =>
  Object.entries(errors).some(
    ([path, message]) =>
      Boolean(message) && path.startsWith("availabilities.") && !SIMPLE_PRICE_FIELD.test(path)
  );
