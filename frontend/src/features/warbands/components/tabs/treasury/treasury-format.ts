import { getSignedTradePrice } from "../../../utils/warband-utils";

import type { WarbandTrade, WarbandTradeChild } from "../../../types/warband-types";

/**
 * What a ledger row did to the gold: spending negative, income positive. The browser signs the
 * stored price by its action until the server stores signed prices (PR C); then this reads them.
 */
export const rowAmount = (row: Pick<WarbandTrade | WarbandTradeChild, "action" | "price">) =>
  getSignedTradePrice(row);

/** A row's change, or a group header's: the total of its children, never "Group" (BUG-38). */
export const rowTotal = (row: WarbandTrade) =>
  row.children.length > 0
    ? row.children.reduce((sum, child) => sum + rowAmount(child), 0)
    : rowAmount(row);

/** "+5 gc", "-10 gc", or "-" for nothing. */
export const formatSignedAmount = (signed: number) =>
  signed === 0 ? "-" : `${signed > 0 ? "+" : ""}${signed} gc`;

/** The action badge: red for spending, green for income. */
export const badgeClass = (isExpense: boolean) =>
  isExpense
    ? "rounded border border-red-700/70 bg-red-900/40 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-red-200"
    : "rounded border border-emerald-700/70 bg-emerald-900/40 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-emerald-200";

/** The badge of an action on its own (a row without children). */
export const actionBadgeClass = (action: string) => badgeClass(rowAmount({ action, price: 1 }) < 0);

/** "Oct 01", or nothing for a date that can't be read. */
export const formatRowDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
};
