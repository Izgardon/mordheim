import { payloadOf, renderGoldBadge, type LogFormatter } from "./badges";

import type { WarbandLog } from "../../types/warband-types";

/** Where copies were: `stash`, `hero`, `hired_sword` or `henchmen_group`, with the unit's name. */
type Place = { type?: string; name?: string | null };

type ItemCopies = { item?: string; quantity?: number };

type ItemSalePayload = ItemCopies & { price?: number; source_type?: string; source_name?: string };

type ItemMovePayload = ItemCopies & {
  source_type?: string;
  source_name?: string | null;
  target_type?: string;
  target_name?: string | null;
};

type TradeSide = { gold?: number; items?: ItemCopies[] };

type TradeCompletedPayload = { partner?: string; sent?: TradeSide; received?: TradeSide };

const UNNAMED: Record<string, string> = {
  hero: "a hero",
  hired_sword: "a hired sword",
  henchmen_group: "a henchmen group",
};

/** "the stash", the unit's name, or its kind when it has none. */
const placeOf = ({ type, name }: Place) =>
  type === "stash" ? "the stash" : name || UNNAMED[type ?? ""] || "a unit";

/** "Sword", or "Sword x 2". */
const copiesOf = ({ item, quantity }: ItemCopies) => {
  const count = Number(quantity ?? 1);
  const name = item || "Unknown Item";
  return Number.isFinite(count) && count > 1 ? `${name} x ${count}` : name;
};

/** "30 gc, Sword x 2", or "nothing". */
const sideOf = (side: TradeSide = {}) => {
  const parts = [
    ...(Number(side.gold) > 0 ? [`${side.gold} gc`] : []),
    ...(side.items ?? []).map(copiesOf),
  ];
  return parts.length > 0 ? parts.join(", ") : "nothing";
};

const sold = (log: WarbandLog) => {
  const payload = payloadOf<ItemSalePayload>(log);
  const price = Number(payload.price ?? 0);
  const from = placeOf({ type: payload.source_type, name: payload.source_name });
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>
        Sold {copiesOf(payload)} from {from}
      </span>
      {Number.isFinite(price) && price > 0 ? (
        <span className="inline-flex items-center gap-1">
          <span>(</span>
          {renderGoldBadge(price)}
          <span>)</span>
        </span>
      ) : null}
    </span>
  );
};

const moved = (log: WarbandLog) => {
  const payload = payloadOf<ItemMovePayload>(log);
  const from = placeOf({ type: payload.source_type, name: payload.source_name });
  const to = placeOf({ type: payload.target_type, name: payload.target_name });
  return `Moved ${copiesOf(payload)} from ${from} to ${to}`;
};

const discarded = (log: WarbandLog) => `Discarded ${copiesOf(payloadOf<ItemCopies>(log))}`;

const tradeCompleted = (log: WarbandLog) => {
  const payload = payloadOf<TradeCompletedPayload>(log);
  const partner = payload.partner || "another warband";
  return `Traded with ${partner}: sent ${sideOf(payload.sent)}; received ${sideOf(payload.received)}`;
};

/** Entries the server writes for item sales, moves and discards, and completed trades. */
export const ITEM_FORMATTERS: Record<string, LogFormatter> = {
  "items:sold": sold,
  "items:moved": moved,
  "items:discarded": discarded,
  "trade:completed": tradeCompleted,
};
