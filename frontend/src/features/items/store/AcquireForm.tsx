import { useState } from "react";

import { Chip } from "@/components/ui/chip";

import type { Item, ItemAvailability } from "../types/item-types";
import { isCommon, priceLabel, rarityLabel, rolledPrice } from "../utils/item-prices";
import AddToBasket from "./AddToBasket";
import PriceFields from "./PriceFields";
import RareSearch, { type StoreSearch } from "./RareSearch";
import type { BasketLine, Recipient } from "./useStoreBasket";

type AcquireFormProps = {
  warbandId: number;
  item: Item;
  /** The rows this warband may buy at, the server's choice first (one row when it can't usually). */
  rows: ItemAvailability[];
  /** The price to start from (Buy again's current price), else the row's cost. */
  startPrice?: number | null;
  /** The bonus a rare search starts on: the warband's variant's (Marienburg +1, the Kurgan -1). */
  startBonus?: number;
  recipients: Recipient[];
  /** The unit the store was opened for: its button comes first, highlighted. */
  firstKey: string | null;
  searchers: { id: number; name: string; spent: boolean }[];
  isMobile: boolean;
  onPick: (line: Omit<BasketLine, "id">) => void;
};

/** The hero a recipient key names ("heroes:5"), else null. */
const heroOf = (key: string | null) =>
  key?.startsWith("heroes:") ? Number(key.slice("heroes:".length)) : null;

/**
 * Getting one item (design E, the items rebuild): the price row (a choice when the warband may use
 * several: "Brace"), its note ("Heroes only") shown and never checked; the price each, prefilled
 * and editable, a price with dice ("25 + 2D6") rolled or typed and sent with its row so the server
 * adds the roll; Free, for an item found or given; for a rare item the search beside the price
 * (layout D), then one button per recipient with its total, which puts the item in the basket. A
 * rare item's buttons wait until it was found, or No search is ticked, or it is free.
 */
export default function AcquireForm(props: AcquireFormProps) {
  const { item, rows } = props;
  const [rowId, setRowId] = useState(rows[0]?.id ?? 0);
  const row = rows.find((entry) => entry.id === rowId) ?? rows[0];
  const [price, setPrice] = useState(String(props.startPrice ?? row?.cost ?? 0));
  const [edited, setEdited] = useState(props.startPrice != null);
  const [rolled, setRolled] = useState<number | null>(null);
  const [free, setFree] = useState(false);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState<StoreSearch | null>(null);
  const [noSearch, setNoSearch] = useState(false);
  if (!row) return null;
  const rare = !isCommon(row.rarity);
  const each = Math.max(0, Math.trunc(Number(price) || 0));
  const needsRoll = Boolean(row.dice) && rolled === null && !edited && !free;
  const cleared = (!rare || free || noSearch || Boolean(search?.found)) && !needsRoll;

  const pickRow = (next: ItemAvailability) => {
    setRowId(next.id);
    setPrice(String(next.cost ?? 0));
    setEdited(false);
    setRolled(null);
    setSearch(null);
    setNoSearch(false);
  };
  const take = (faces: number[]) => {
    const pips = faces.reduce((sum, value) => sum + value, 0);
    setRolled(pips);
    setEdited(false);
    setPrice(String(rolledPrice(row, pips)));
  };
  const pick = (recipient: Recipient) =>
    props.onPick({
      item,
      availabilityId: row.id,
      baseCost: row.cost ?? 0,
      recipient,
      price: free ? 0 : each,
      free,
      reason: free ? reason : "",
      diceRoll: rolled,
      rowPrice: !edited && !free && row.cost != null,
    });
  const fields = (
    <PriceFields
      item={item}
      row={row}
      price={price}
      rolled={rolled}
      free={free}
      reason={reason}
      isMobile={props.isMobile}
      inColumn={rare}
      onPrice={(text) => {
        setPrice(text);
        setEdited(true);
      }}
      onRoll={take}
      onFree={setFree}
      onReason={setReason}
    />
  );

  return (
    <div className="flex flex-col gap-3 border border-accent-line bg-surface p-3.5">
      {rows.length > 1 ? (
        <div role="group" aria-label="Price" className="flex flex-wrap gap-1.5">
          {rows.map((entry) => (
            <Chip key={entry.id} pressed={entry.id === row.id} onClick={() => pickRow(entry)}>
              {entry.label || priceLabel(entry)} · {rarityLabel(entry.rarity)}
            </Chip>
          ))}
        </div>
      ) : null}
      {row.label || row.note || row.cost_note ? (
        <p className="m-0 text-xs text-text2">
          {[row.label, row.cost_note, row.note].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {rare ? (
        <RareSearch
          key={row.id}
          warbandId={props.warbandId}
          item={item}
          rarity={row.rarity ?? 2}
          startBonus={props.startBonus ?? 0}
          searchers={props.searchers}
          firstHeroId={heroOf(props.firstKey)}
          search={search}
          disabled={free}
          isMobile={props.isMobile}
          price={fields}
          onSearch={setSearch}
        />
      ) : (
        fields
      )}
      {rare || cleared ? (
        <AddToBasket
          recipients={props.recipients}
          firstKey={props.firstKey}
          each={each}
          free={free}
          isMobile={props.isMobile}
          noSearch={rare ? { checked: noSearch, onChange: setNoSearch } : null}
          enabled={cleared}
          onAdd={pick}
        />
      ) : null}
    </div>
  );
}
