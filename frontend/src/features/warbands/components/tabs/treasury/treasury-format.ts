import type { WarbandTrade, WarbandTradeChild } from "../../../types/warband-types";

/** What a ledger row did to the gold: the server stores it signed (decision 4), spending negative. */
export const rowAmount = (row: Pick<WarbandTrade | WarbandTradeChild, "price">) => row.price || 0;

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

/** The server's action names (decision 4), found by any case and by the names rows had before. */
const ACTION_NAMES: Record<string, string> = {
  buy: "Buy",
  bought: "Buy",
  sell: "Sell",
  sold: "Sell",
  recruit: "Recruit",
  recruited: "Recruit",
  hire: "Hire",
  hired: "Hire",
  upkeep: "Upkeep",
  reward: "Reward",
  exploration: "Exploration",
  trade: "Trade",
  "trade sent": "Trade",
  "trade received": "Trade",
  adjustment: "Adjustment",
  "starting gold": "Starting gold",
  group: "Group",
};

/** A row's action as the ledger names it ("Buy", "Adjustment"); anything else as it is. */
export const formatTradeAction = (action: string) =>
  ACTION_NAMES[action.trim().toLowerCase()] ?? action.trim();

/** "Oct 01", or nothing for a date that can't be read. */
export const formatRowDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
};
