import { useState } from "react";
import { Dices, Minus, Plus } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { rollDice } from "@/lib/dice";
import { cn } from "@/lib/utils";

import type { Item, ItemAvailability } from "../types/item-types";
import { diceLabel, isCommon, priceLabel, rarityLabel, rolledPrice } from "../utils/item-prices";
import RareSearch, { type StoreSearch } from "./RareSearch";
import type { BasketLine, Recipient } from "./useStoreBasket";

type AcquireFormProps = {
  warbandId: number;
  item: Item;
  /** The rows this warband may buy at, the server's choice first (one row when it can't usually). */
  rows: ItemAvailability[];
  /** The price to start from (Buy again's current price), else the row's cost. */
  startPrice?: number | null;
  recipients: Recipient[];
  /** The unit the store was opened for: its button comes first, highlighted. */
  firstKey: string | null;
  searchers: { id: number; name: string; spent: boolean }[];
  isMobile: boolean;
  onPick: (line: Omit<BasketLine, "id">) => void;
};

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/**
 * Getting one item (design E, the items rebuild): the price row (a choice when the warband may use
 * several: "Brace"), its note ("Heroes only") shown and never checked; the price each, prefilled
 * and editable, a price with dice ("25 + 2D6") rolled with the button and sent with its row so the
 * server adds the roll; Free, for an item found or given; for a rare item the search; then one
 * button per recipient with its total, which puts the item in the basket.
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
  const [bonus, setBonus] = useState(0);
  const [search, setSearch] = useState<StoreSearch | null>(null);
  const [skipped, setSkipped] = useState(false);
  if (!row) return null;
  const rare = !isCommon(row.rarity);
  const each = Math.max(0, Math.trunc(Number(price) || 0));
  const needsRoll = Boolean(row.dice) && rolled === null && !edited && !free;
  const cleared = (!rare || free || skipped || Boolean(search?.found)) && !needsRoll;

  const pickRow = (next: ItemAvailability) => {
    setRowId(next.id);
    setPrice(String(next.cost ?? 0));
    setEdited(false);
    setRolled(null);
    setSearch(null);
    setSkipped(false);
  };
  const roll = () => {
    if (!row.dice) return;
    const pips = rollDice(row.dice).reduce((sum, value) => sum + value, 0);
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
  const changeBonus = (next: number) => {
    setBonus(Math.max(-3, Math.min(10, next)));
    setSearch(null);
  };

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
      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5">
        <label className={LABEL}>
          {props.isMobile ? "Price each" : "Price each (gc)"}
          <Input
            inputMode="numeric"
            aria-label={`Price each for ${item.name}`}
            className={cn("font-mono", props.isMobile ? "h-11 w-24" : "w-[110px]")}
            value={price}
            disabled={free}
            onChange={(event) => {
              setPrice(event.target.value);
              setEdited(true);
            }}
          />
        </label>
        {row.dice ? (
          <div className="flex min-h-10 items-center gap-2">
            {props.isMobile ? null : (
              <span className="font-mono text-[13px] text-text2">
                {row.cost ?? 0} + {diceLabel(row)}
              </span>
            )}
            <button
              type="button"
              onClick={roll}
              disabled={free}
              className="flex min-h-9 items-center gap-1.5 border border-strong px-2.5 text-xs font-bold text-ink disabled:opacity-50"
            >
              <Dices className="h-3.5 w-3.5" aria-hidden="true" />
              {rolled === null ? "Roll it" : `Rolled ${rolled}, reroll`}
            </button>
          </div>
        ) : null}
        <label className="ml-auto flex min-h-10 items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={free}
            onChange={(event) => setFree(event.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Free
        </label>
      </div>
      {free ? (
        <Input
          aria-label="Why it is free"
          placeholder="Why it is free"
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
        />
      ) : null}
      {rare && !free ? (
        <div className="flex flex-col gap-2 border-t border-line pt-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-bold text-muted-foreground">
              Rare {row.rarity} · search on 2D6
            </span>
            <div
              role="group"
              aria-label="Search bonus"
              className="ml-auto flex items-center gap-1.5"
            >
              <span className="text-xs font-bold text-muted-foreground">Bonus</span>
              <IconButton
                aria-label="Lower the bonus"
                className={props.isMobile ? "h-10 w-10" : "h-8 w-8"}
                disabled={bonus <= -3}
                onClick={() => changeBonus(bonus - 1)}
              >
                <Minus aria-hidden="true" />
              </IconButton>
              <span className="min-w-[30px] text-center font-mono text-sm font-bold text-head">
                {bonus > 0 ? `+${bonus}` : bonus}
              </span>
              <IconButton
                aria-label="Raise the bonus"
                className={props.isMobile ? "h-10 w-10" : "h-8 w-8"}
                disabled={bonus >= 10}
                onClick={() => changeBonus(bonus + 1)}
              >
                <Plus aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          <RareSearch
            warbandId={props.warbandId}
            item={item}
            rarity={row.rarity ?? 2}
            bonus={bonus}
            searchers={props.searchers}
            search={search}
            skipped={skipped}
            isMobile={props.isMobile}
            onSearch={(next) => {
              setSearch(next);
              setSkipped(false);
            }}
            onSkip={() => {
              setSkipped(true);
              setSearch(null);
            }}
          />
        </div>
      ) : null}
      {cleared ? (
        <div className="flex flex-wrap gap-1.5">
          {props.recipients.map((recipient) => {
            const mine = recipient.key === props.firstKey;
            const total = free ? "free" : `${each * recipient.count} gc`;
            const count = recipient.count > 1 ? ` ×${recipient.count}` : "";
            return (
              <button
                key={recipient.key}
                type="button"
                onClick={() => pick(recipient)}
                className={cn(
                  "border px-3 text-[13px] font-bold",
                  props.isMobile ? "min-h-11" : "min-h-[38px]",
                  mine
                    ? "border-primary bg-primary text-on-accent"
                    : "border-accent-line bg-page text-accent-hi hover:bg-accent-soft"
                )}
              >
                {recipient.label}
                {count} · {total}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
